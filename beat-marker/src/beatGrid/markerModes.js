/**
 * markerModes.js — pure selection of which beats become markers.
 *
 * Extensible by design: add a new mode by registering a predicate in MODES.
 * Every mode is a pure (beat, ctx) => boolean filter over the BeatGrid beats,
 * so new modes never touch UI or the Premiere layer.
 */

/** Canonical mode ids. Keep in sync with the UI dropdown. */
export const MarkerMode = Object.freeze({
  ALL_BEATS: 'ALL_BEATS',
  STRONG_BEATS: 'STRONG_BEATS',
  DOWNBEATS: 'DOWNBEATS',
  EVERY_2_BEATS: 'EVERY_2_BEATS',
  EVERY_4_BEATS: 'EVERY_4_BEATS',
});

/**
 * Predicate registry. `ctx` carries { strongThreshold } for tunable modes.
 * "Every N" counts from each bar's downbeat (beatInBar), so it stays musically
 * aligned instead of drifting with the global index.
 */
const MODES = {
  [MarkerMode.ALL_BEATS]: () => true,
  [MarkerMode.STRONG_BEATS]: (b, ctx) =>
    b.type === 'downbeat' || b.type === 'strong' || b.strength >= (ctx.strongThreshold ?? 0.75),
  [MarkerMode.DOWNBEATS]: (b) => b.type === 'downbeat',
  [MarkerMode.EVERY_2_BEATS]: (b) => (b.beatInBar - 1) % 2 === 0,
  [MarkerMode.EVERY_4_BEATS]: (b) => (b.beatInBar - 1) % 4 === 0,
};

/**
 * Select beats for a given mode.
 * @param {import('./BeatGrid.js').BeatGrid} grid
 * @param {string} mode
 * @param {{ strongThreshold?:number }} [ctx]
 * @returns {import('./BeatGrid.js').Beat[]}
 */
export function selectBeats(grid, mode, ctx = {}) {
  const predicate = MODES[mode];
  if (!predicate) throw new RangeError(`Unknown marker mode: ${mode}`);
  return grid.beats.filter((b) => predicate(b, ctx));
}

/** True if the mode id is registered. */
export function isValidMode(mode) {
  return Object.prototype.hasOwnProperty.call(MODES, mode);
}
