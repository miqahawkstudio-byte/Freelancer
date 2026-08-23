/**
 * dsp.js — beat-detection DSP primitives. Pure JS, no host/UI dependency.
 *
 * Pipeline (classic, no LLM):
 *   spectral-flux onset envelope
 *     -> autocorrelation tempo estimate (parabolic-interpolated peak)
 *     -> phase-locked beat grid
 *     -> meter / downbeat by accent contrast
 *
 * This is the reference engine. The native aubio (.uxpaddon) and WASM backends
 * implement the same idea in C for speed; all three return the same BeatGrid, so
 * the choice between them is a benchmark decision, not an API change.
 */

import { magnitudeSpectrum } from '../audio/fft.js';

const FRAME = 1024;
const HOP = 512;

/**
 * Spectral-flux onset envelope.
 * @param {Float32Array} x mono samples in [-1,1]
 * @param {number} sampleRate
 * @returns {{ env:Float64Array, fps:number }} env is >=0, normalized to max 1
 */
export function onsetEnvelope(x, sampleRate) {
  const hann = hannWindow(FRAME);
  const nFrames = Math.max(0, 1 + Math.floor((x.length - FRAME) / HOP));
  const env = new Float64Array(Math.max(0, nFrames));
  const frame = new Float64Array(FRAME);
  let prev = null;

  for (let f = 0; f < nFrames; f++) {
    const start = f * HOP;
    for (let i = 0; i < FRAME; i++) frame[i] = x[start + i] * hann[i];
    const mag = magnitudeSpectrum(frame);
    if (prev) {
      let flux = 0;
      for (let k = 0; k < mag.length; k++) {
        const d = mag[k] - prev[k];
        if (d > 0) flux += d;
      }
      env[f] = flux;
    }
    prev = mag;
  }

  smoothSubtract(env, 8); // adaptive threshold: subtract local mean, half-wave rectify
  normalizeMax(env);
  return { env, fps: sampleRate / HOP };
}

/**
 * Estimate tempo by autocorrelating the onset envelope.
 * @returns {{ bpm:number, periodFrames:number, strength:number }}
 */
export function estimateTempo(env, fps, minBpm = 40, maxBpm = 220) {
  const lagMin = Math.max(2, Math.floor((fps * 60) / maxBpm));
  const lagMax = Math.min(env.length - 1, Math.ceil((fps * 60) / minBpm));

  let bestLag = lagMin;
  let bestVal = -Infinity;
  const r = new Float64Array(lagMax + 1);
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let s = 0;
    for (let n = lag; n < env.length; n++) s += env[n] * env[n - lag];
    r[lag] = s;
    if (s > bestVal) {
      bestVal = s;
      bestLag = lag;
    }
  }

  // Parabolic interpolation around the peak for sub-frame precision.
  let lag = bestLag;
  if (bestLag > lagMin && bestLag < lagMax) {
    const a = r[bestLag - 1];
    const b = r[bestLag];
    const c = r[bestLag + 1];
    const denom = a - 2 * b + c;
    if (denom !== 0) lag = bestLag + (0.5 * (a - c)) / denom;
  }

  const bpm = (fps * 60) / lag;
  const energy = sumSquares(env) || 1;
  return { bpm, periodFrames: lag, strength: bestVal / energy };
}

/**
 * Find the best beat phase for a given period and return beat frame positions.
 * Phase maximizes the summed onset energy landing on the grid.
 * @returns {number[]} beat positions in frames
 */
export function trackBeats(env, periodFrames) {
  const period = periodFrames;
  const nBeats = Math.floor((env.length - 1) / period);
  if (nBeats < 1) return [];

  // Search phase at ~0.1-frame resolution over one period.
  let bestPhase = 0;
  let bestScore = -Infinity;
  const steps = Math.max(8, Math.ceil(period * 4));
  for (let s = 0; s < steps; s++) {
    const phase = (s / steps) * period;
    let score = 0;
    for (let k = 0; k <= nBeats; k++) {
      const idx = Math.round(phase + k * period);
      if (idx >= 0 && idx < env.length) score += env[idx];
    }
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }

  const beats = [];
  for (let k = 0; k <= nBeats; k++) {
    const idx = phaseRefine(env, bestPhase + k * period);
    if (idx >= 0 && idx < env.length) beats.push(idx);
  }
  return beats;
}

/**
 * Choose meter (4/4 vs 3/4) and the downbeat offset by accent contrast:
 * the arrangement where bar-starts carry the most onset energy relative to
 * other beats wins. Returns { bpb, downbeatOffset, contrast }.
 */
export function estimateMeter(env, beatFrames, candidates = [4, 3]) {
  const strengths = beatFrames.map((f) => env[Math.min(env.length - 1, Math.max(0, f))]);
  let best = { bpb: 4, downbeatOffset: 0, contrast: -Infinity };

  for (const bpb of candidates) {
    for (let d = 0; d < bpb; d++) {
      let onSum = 0;
      let onCount = 0;
      let offSum = 0;
      let offCount = 0;
      for (let i = 0; i < strengths.length; i++) {
        if (((i - d) % bpb + bpb) % bpb === 0) {
          onSum += strengths[i];
          onCount++;
        } else {
          offSum += strengths[i];
          offCount++;
        }
      }
      const onAvg = onCount ? onSum / onCount : 0;
      const offAvg = offCount ? offSum / offCount : 0;
      const contrast = onAvg - offAvg;
      if (contrast > best.contrast) best = { bpb, downbeatOffset: d, contrast };
    }
  }
  return best;
}

/** Onset peak times (seconds) — used for BPM octave scoring. */
export function onsetPeaks(env, fps, threshold = 0.2) {
  const peaks = [];
  for (let i = 1; i < env.length - 1; i++) {
    if (env[i] >= threshold && env[i] > env[i - 1] && env[i] >= env[i + 1]) {
      peaks.push(i / fps);
    }
  }
  return peaks;
}

// ---- helpers ---------------------------------------------------------------

function phaseRefine(env, pos) {
  // Snap to the nearest local maximum within +/-1 frame of the predicted grid.
  const i = Math.round(pos);
  let best = i;
  for (let j = Math.max(1, i - 1); j <= Math.min(env.length - 2, i + 1); j++) {
    if (env[j] > env[best]) best = j;
  }
  return best;
}

function hannWindow(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

function smoothSubtract(env, radius) {
  const out = new Float64Array(env.length);
  for (let i = 0; i < env.length; i++) {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(env.length - 1, i + radius); j++) {
      s += env[j];
      c++;
    }
    const local = c ? s / c : 0;
    out[i] = Math.max(0, env[i] - local);
  }
  env.set(out);
}

function normalizeMax(env) {
  let m = 0;
  for (let i = 0; i < env.length; i++) if (env[i] > m) m = env[i];
  if (m > 0) for (let i = 0; i < env.length; i++) env[i] /= m;
}

function sumSquares(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return s;
}
