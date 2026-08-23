/**
 * analyze.js — the reference (pure-JS) implementation of analyzeAudio().
 *
 * Input: normalized mono Float32Array + sample rate. Output: a BeatGrid whose
 * beat times are in seconds relative to the start of the analyzed audio. The
 * Premiere layer maps those to timeline ticks (see beatGrid/placement.js).
 *
 * The native/WASM backends must return the identical shape so they are drop-in.
 */

import { onsetEnvelope, estimateTempo, trackBeats, estimateMeterFromAccents, onsetPeaks } from './dsp.js';
import { correctOctave } from '../beatGrid/bpm.js';
import { validateGrid } from '../beatGrid/BeatGrid.js';

/**
 * @param {{ samples:Float32Array, sampleRate:number }} audio
 * @param {Object} [options]
 * @param {number} [options.minBpm=40]
 * @param {number} [options.maxBpm=220]
 * @param {number} [options.manualBpm]  when set, skip tempo estimation
 * @param {number} [options.sensitivity=0.5] 0..1, raises/lowers onset peak gate
 * @param {(p:number)=>void} [options.onProgress] 0..1
 * @param {() => boolean} [options.isCancelled]
 * @returns {import('../beatGrid/BeatGrid.js').BeatGrid}
 */
export function analyzeAudioJs(audio, options = {}) {
  const { samples, sampleRate } = audio;
  const {
    minBpm = 40,
    maxBpm = 220,
    manualBpm,
    sensitivity = 0.5,
    silenceFloor = 0.005,
    meterHint = 'auto',
    onProgress,
    isCancelled,
  } = options;

  const tick = (p) => {
    if (typeof onProgress === 'function') onProgress(p);
    if (typeof isCancelled === 'function' && isCancelled()) {
      const e = new Error('cancelled');
      e.cancelled = true;
      throw e;
    }
  };

  tick(0.05);
  const { env, fps } = onsetEnvelope(samples, sampleRate);
  tick(0.5);

  if (env.length < 4) {
    // Not enough signal to analyze.
    return { bpm: manualBpm || 0, meter: '4/4', confidence: 0, firstBeat: 0, beats: [], downbeats: [] };
  }

  // Tempo (unless the user forced a manual BPM).
  let bpm;
  let tempoStrength;
  if (manualBpm && manualBpm > 0) {
    bpm = manualBpm;
    tempoStrength = 1;
  } else {
    const t = estimateTempo(env, fps, minBpm, maxBpm);
    const peaks = onsetPeaks(env, fps, 0.15 + 0.2 * (1 - sensitivity));
    bpm = correctOctave(t.bpm, { onsets: peaks, min: minBpm, max: maxBpm }).bpm;
    tempoStrength = t.strength;
  }
  tick(0.65);

  const periodFrames = (fps * 60) / bpm;
  const periodSeconds = 60 / bpm;
  let beatFrames = trackBeats(env, periodFrames);

  // Gap gating: drop beats that land in silence (e.g. between clips on a track).
  // Gaps are true digital silence, so a small absolute RMS floor removes phantom
  // beats there without touching genuinely quiet musical beats.
  const rmsWin = Math.max(1, Math.round(sampleRate * 0.05));
  beatFrames = beatFrames.filter(
    (f) => localRms(samples, Math.round((f * sampleRate) / fps), rmsWin) >= silenceFloor
  );
  tick(0.85);

  if (beatFrames.length === 0) {
    return { bpm: round2(bpm), meter: '4/4', confidence: 0, firstBeat: 0, beats: [], downbeats: [] };
  }

  // Number beats by GRID position (time), not array position, so a gap does not
  // renumber the beats after it — bar/beat counts stay musically correct.
  const strongThreshold = 0.6 + 0.3 * (1 - sensitivity);
  const t0 = beatFrames[0] / fps;
  const giList = beatFrames.map((f) => Math.round((f / fps - t0) / periodSeconds));
  const strengthList = beatFrames.map((f) => clamp01(env[Math.min(env.length - 1, f)]));

  // Honor an explicit meter hint (Time Signature dropdown); else auto 4/4 vs 3/4.
  // Meter is estimated over GRID positions so its downbeat phase matches the
  // numbering below even when beats were dropped in gaps.
  const meterCandidates = meterHint === '3/4' ? [3] : meterHint === '4/4' ? [4] : [4, 3];
  const { bpb, downbeatOffset, contrast } = estimateMeterFromAccents(giList, strengthList, meterCandidates);
  const meter = `${bpb}/4`;

  const rawBeats = beatFrames.map((f, i) => {
    const time = f / fps;
    const gi = giList[i];
    const beatInBar = (((gi - downbeatOffset) % bpb) + bpb) % bpb + 1;
    const strength = strengthList[i];
    return { time, gi, beatInBar, strength, _rawBar: Math.floor((gi - downbeatOffset) / bpb) };
  });
  const minBar = Math.min(...rawBeats.map((b) => b._rawBar));
  const beats = rawBeats.map((b, i) => {
    const bar = b._rawBar - minBar + 1;
    const type = b.beatInBar === 1 ? 'downbeat' : b.strength >= strongThreshold ? 'strong' : 'beat';
    return { time: round6(b.time), index: i + 1, bar, beatInBar: b.beatInBar, strength: round3(b.strength), type };
  });
  const downbeats = beats.filter((b) => b.type === 'downbeat').map((b) => b.time);

  // Confidence: tempo peak strength blended with how strongly beats land on onsets.
  const meanBeatStrength = beats.length
    ? beats.reduce((s, b) => s + b.strength, 0) / beats.length
    : 0;
  const confidence = clamp01(0.5 * clamp01(tempoStrength * 4) + 0.5 * meanBeatStrength);

  tick(1);

  const grid = {
    bpm: round2(bpm),
    meter,
    confidence: round3(confidence),
    firstBeat: beats.length ? beats[0].time : 0,
    beats,
    downbeats,
    source: { engine: 'js', sampleRate, meterContrast: round3(contrast) },
  };
  validateGrid(grid);
  return grid;
}

/** RMS of the samples in a window centered on `center`. */
function localRms(samples, center, win) {
  const half = win >> 1;
  let s = 0;
  let n = 0;
  const a = Math.max(0, center - half);
  const b = Math.min(samples.length, center + half);
  for (let i = a; i < b; i++) {
    s += samples[i] * samples[i];
    n++;
  }
  return n ? Math.sqrt(s / n) : 0;
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}
function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}
function round3(n) {
  return Math.round(n * 1e3) / 1e3;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
