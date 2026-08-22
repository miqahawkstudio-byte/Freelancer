/**
 * BeatGrid.js — the engine's output contract. Pure data + helpers, no UI/host.
 *
 * The BeatGrid is the single source of truth that every other module consumes:
 * the DSP engine produces it, the marker layer reads it, and future features
 * (Cut on Beat, Snap to Beat, CSV/JSON export) will read the same structure.
 * Keeping it independent of UI and of Premiere is a hard requirement.
 *
 * @typedef {'downbeat'|'strong'|'beat'} BeatType
 *
 * @typedef {Object} Beat
 * @property {number}  time       seconds, relative to the analyzed audio start
 * @property {number}  index      1-based global beat index
 * @property {number}  bar        1-based bar number
 * @property {number}  beatInBar  1-based position within the bar
 * @property {number}  strength   0..1 onset/energy strength
 * @property {BeatType} type
 *
 * @typedef {Object} BeatGrid
 * @property {number}   bpm
 * @property {string}   meter        e.g. "4/4"
 * @property {number}   confidence   0..1
 * @property {number}   firstBeat    seconds of the first detected beat
 * @property {Beat[]}   beats
 * @property {number[]} downbeats    convenience list of downbeat times (seconds)
 * @property {object}   [source]     provenance (file/clip/sequence range) — optional
 */

/** Beats-per-bar from a "n/d" meter string. */
export function beatsPerBar(meter) {
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(String(meter).trim());
  if (!m) throw new RangeError(`Invalid meter: ${meter}`);
  return parseInt(m[1], 10);
}

/**
 * Build a BeatGrid mathematically from BPM + first beat + meter. This is what
 * "Use Manual BPM" relies on: when the detector locks the rhythm but reports the
 * wrong octave (half/double), the user fixes BPM and we regenerate the grid.
 *
 * @param {Object} opts
 * @param {number} opts.bpm
 * @param {number} opts.firstBeat        seconds
 * @param {number} opts.durationSeconds  total length to fill with beats
 * @param {string} [opts.meter="4/4"]
 * @param {number} [opts.confidence=1]
 * @param {(beatInBar:number)=>number} [opts.strengthFn] optional strength model
 * @returns {BeatGrid}
 */
export function buildGridFromBpm({
  bpm,
  firstBeat,
  durationSeconds,
  meter = '4/4',
  confidence = 1,
  strengthFn,
}) {
  if (!(bpm > 0)) throw new RangeError(`bpm must be > 0, got ${bpm}`);
  if (!(durationSeconds >= 0)) throw new RangeError('durationSeconds must be >= 0');

  const bpb = beatsPerBar(meter);
  const period = 60 / bpm;
  const beats = [];
  const downbeats = [];

  let index = 1;
  for (let t = firstBeat; t <= firstBeat + durationSeconds + 1e-9; t += period) {
    const beatInBar = ((index - 1) % bpb) + 1;
    const bar = Math.floor((index - 1) / bpb) + 1;
    const type = beatInBar === 1 ? 'downbeat' : 'beat';
    const strength =
      typeof strengthFn === 'function'
        ? clamp01(strengthFn(beatInBar))
        : type === 'downbeat'
        ? 1
        : 0.6;
    const beat = { time: round6(t), index, bar, beatInBar, strength, type };
    beats.push(beat);
    if (type === 'downbeat') downbeats.push(beat.time);
    index += 1;
  }

  return {
    bpm,
    meter,
    confidence: clamp01(confidence),
    firstBeat: round6(firstBeat),
    beats,
    downbeats,
  };
}

/**
 * Shift an existing grid so its first beat lands at `newFirstBeat`, keeping the
 * same tempo/structure. Used by the First Beat Offset control. Returns a new
 * grid (does not mutate the input).
 */
export function shiftGrid(grid, newFirstBeat) {
  const delta = newFirstBeat - grid.firstBeat;
  const beats = grid.beats.map((b) => ({ ...b, time: round6(b.time + delta) }));
  return {
    ...grid,
    firstBeat: round6(newFirstBeat),
    beats,
    downbeats: beats.filter((b) => b.type === 'downbeat').map((b) => b.time),
  };
}

/** Basic invariants — cheap guard used by tests and before marker creation. */
export function validateGrid(grid) {
  if (!grid || typeof grid !== 'object') throw new Error('grid missing');
  if (!(grid.bpm > 0)) throw new Error('grid.bpm invalid');
  if (!Array.isArray(grid.beats)) throw new Error('grid.beats missing');
  for (let i = 1; i < grid.beats.length; i++) {
    if (grid.beats[i].time < grid.beats[i - 1].time) {
      throw new Error(`beats not monotonic at index ${i}`);
    }
  }
  return true;
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}
function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}
