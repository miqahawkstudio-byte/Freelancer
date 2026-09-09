/**
 * sections.js — pure energy analysis: envelope, silence, and energy-change
 * (drop / build) detection. Groundwork for V2 (drops, transitions, silence,
 * energy-change markers). No host/UI dependency; engine-independent so it is
 * unit-testable and reusable by any consumer of a decoded buffer.
 *
 * Times returned are seconds relative to the analyzed audio start — the same
 * reference the BeatGrid uses — so they compose with marker placement.
 */

const FRAME = 2048;
const HOP = 1024;

/**
 * Short-time RMS energy envelope.
 * @param {Float32Array} x mono samples
 * @param {number} sampleRate
 * @returns {{ energy:Float32Array, fps:number }} energy is raw RMS (>=0)
 */
export function energyEnvelope(x, sampleRate) {
  const nFrames = Math.max(0, 1 + Math.floor((x.length - FRAME) / HOP));
  const energy = new Float32Array(Math.max(0, nFrames));
  for (let f = 0; f < nFrames; f++) {
    const start = f * HOP;
    let s = 0;
    for (let i = 0; i < FRAME; i++) {
      const v = x[start + i];
      s += v * v;
    }
    energy[f] = Math.sqrt(s / FRAME);
  }
  return { energy, fps: sampleRate / HOP };
}

/**
 * Contiguous silent regions (RMS below `threshold` for at least
 * `minDurationSeconds`). Useful for skipping gaps and for V2 silence markers.
 * @returns {Array<[number,number]>} [startSec, endSec] pairs
 */
export function detectSilence(energy, fps, opts = {}) {
  const { threshold = 0.02, minDurationSeconds = 0.3 } = opts;
  const regions = [];
  let runStart = -1;
  for (let i = 0; i <= energy.length; i++) {
    const silent = i < energy.length && energy[i] < threshold;
    if (silent && runStart < 0) runStart = i;
    else if (!silent && runStart >= 0) {
      const startSec = runStart / fps;
      const endSec = i / fps;
      if (endSec - startSec >= minDurationSeconds) regions.push([startSec, endSec]);
      runStart = -1;
    }
  }
  return regions;
}

/**
 * Detect significant energy changes — builds (rise) and drops. Compares the
 * mean energy in a window before vs after each frame; a large signed jump marks
 * a section change. Enforces a minimum gap so a single transition is reported
 * once.
 *
 * @param {Float32Array} energy
 * @param {number} fps
 * @param {Object} [opts]
 * @param {number} [opts.windowSeconds=1.0]  before/after comparison window
 * @param {number} [opts.minJumpRatio=0.25]  fraction of the energy range a jump
 *                                            must exceed to count
 * @param {number} [opts.minGapSeconds=2]    minimum spacing between detections
 * @returns {Array<{ time:number, type:'rise'|'drop', magnitude:number }>}
 */
export function detectEnergyChanges(energy, fps, opts = {}) {
  const { windowSeconds = 1.0, minJumpRatio = 0.25, minGapSeconds = 2 } = opts;
  const n = energy.length;
  if (n < 4) return [];

  const sm = movingAverage(energy, Math.max(1, Math.round(0.2 * fps)));
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of sm) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const range = hi - lo || 1;
  const level = mean(sm, 0, n); // overall energy level
  const W = Math.max(1, Math.round(windowSeconds * fps));

  // Signed before/after difference at each frame.
  const diff = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const before = mean(sm, i - W, i);
    const after = mean(sm, i, i + W);
    diff[i] = after - before;
  }

  // Gate against the larger of the energy range and the overall level, so a
  // steady (merely noisy) signal — small range but non-trivial level — does not
  // trip on random fluctuations, while genuine loud/quiet transitions still do.
  const minJump = minJumpRatio * Math.max(range, level);
  const minGap = Math.round(minGapSeconds * fps);
  const events = [];
  let lastIdx = -Infinity;
  for (let i = 1; i < n - 1; i++) {
    const a = Math.abs(diff[i]);
    if (a < minJump) continue;
    // local extremum of |diff|
    if (a >= Math.abs(diff[i - 1]) && a > Math.abs(diff[i + 1])) {
      if (i - lastIdx < minGap) {
        // too close to the previous detection: keep only the stronger one
        const last = events[events.length - 1];
        if (last && a > Math.abs(last.magnitude)) events.pop();
        else continue;
      }
      events.push({ time: i / fps, type: diff[i] > 0 ? 'rise' : 'drop', magnitude: round3(diff[i]) });
      lastIdx = i;
    }
  }
  return events;
}

// ---- helpers ---------------------------------------------------------------

function movingAverage(a, radius) {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = mean(a, i - radius, i + radius + 1);
  return out;
}

function mean(a, from, to) {
  const lo = Math.max(0, from);
  const hi = Math.min(a.length, to);
  if (hi <= lo) return 0;
  let s = 0;
  for (let i = lo; i < hi; i++) s += a[i];
  return s / (hi - lo);
}

function round3(n) {
  return Math.round(n * 1e3) / 1e3;
}
