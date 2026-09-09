/**
 * snap.js — pure beat-alignment helpers. The data layer for future
 * "Snap Clips to Beat" and "Cut on Beat" features (V2).
 *
 * These operate purely on a BeatGrid's beat times (seconds), independent of the
 * host: the Premiere side (V2) will read the snapped times / cut points from
 * here and call trackItem.move() / the razor. Keeping the math here means it is
 * unit-testable now and the same logic serves every future consumer.
 *
 * All times are seconds in the BeatGrid's own reference (relative to the
 * analyzed audio start); callers add the sequence/range offset when they map to
 * timeline ticks — exactly as marker placement already does.
 */

import { selectBeats, isValidMode, MarkerMode } from './markerModes.js';

/**
 * The candidate beat times for a given mode (defaults to every beat).
 * @param {import('./BeatGrid.js').BeatGrid} grid
 * @param {string} [mode] a MarkerMode id
 * @param {{ strongThreshold?:number }} [ctx]
 * @returns {number[]} sorted beat times (seconds)
 */
export function beatTimes(grid, mode = MarkerMode.ALL_BEATS, ctx = {}) {
  if (!isValidMode(mode)) throw new RangeError(`Unknown mode: ${mode}`);
  return selectBeats(grid, mode, ctx).map((b) => b.time);
}

/**
 * Nearest value in a sorted array to `t` (binary search). Returns null if empty.
 */
export function nearestInSorted(sortedTimes, t) {
  const n = sortedTimes.length;
  if (n === 0) return null;
  let lo = 0;
  let hi = n - 1;
  if (t <= sortedTimes[0]) return sortedTimes[0];
  if (t >= sortedTimes[hi]) return sortedTimes[hi];
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedTimes[mid] === t) return sortedTimes[mid];
    if (sortedTimes[mid] < t) lo = mid + 1;
    else hi = mid - 1;
  }
  // lo is the insertion point; nearest is lo or lo-1.
  const a = sortedTimes[hi];
  const b = sortedTimes[lo];
  return t - a <= b - t ? a : b;
}

/**
 * Snap a single time to the nearest beat.
 * @param {number} t
 * @param {import('./BeatGrid.js').BeatGrid} grid
 * @param {{ mode?:string, maxDistanceSeconds?:number, strongThreshold?:number }} [opts]
 * @returns {{ time:number, delta:number, snapped:boolean }}
 *          `snapped` is false (and time unchanged) if the nearest beat is beyond
 *          maxDistanceSeconds (Infinity by default = always snap).
 */
export function snapTime(t, grid, opts = {}) {
  const { mode = MarkerMode.ALL_BEATS, maxDistanceSeconds = Infinity, strongThreshold } = opts;
  const times = beatTimes(grid, mode, { strongThreshold });
  const nearest = nearestInSorted(times, t);
  if (nearest == null) return { time: t, delta: 0, snapped: false };
  const delta = nearest - t;
  if (Math.abs(delta) > maxDistanceSeconds) return { time: t, delta: 0, snapped: false };
  return { time: nearest, delta, snapped: true };
}

/**
 * Snap many times (e.g. clip edit points) to the grid. Returns one result per
 * input, preserving order.
 * @param {number[]} times
 * @returns {Array<{ input:number, time:number, delta:number, snapped:boolean }>}
 */
export function snapTimes(times, grid, opts = {}) {
  const { mode = MarkerMode.ALL_BEATS, strongThreshold } = opts;
  const candidates = beatTimes(grid, mode, { strongThreshold });
  return times.map((t) => {
    const nearest = nearestInSorted(candidates, t);
    if (nearest == null) return { input: t, time: t, delta: 0, snapped: false };
    const delta = nearest - t;
    if (Math.abs(delta) > (opts.maxDistanceSeconds ?? Infinity)) {
      return { input: t, time: t, delta: 0, snapped: false };
    }
    return { input: t, time: nearest, delta, snapped: true };
  });
}

/**
 * Beat-aligned cut points within [startSeconds, endSeconds] for "Cut on Beat".
 * Excludes the exact range boundaries so a cut is only added strictly inside.
 * @returns {number[]} sorted cut times (seconds)
 */
export function cutPointsInRange(grid, startSeconds, endSeconds, opts = {}) {
  const { mode = MarkerMode.DOWNBEATS, strongThreshold } = opts;
  const times = beatTimes(grid, mode, { strongThreshold });
  return times.filter((t) => t > startSeconds + 1e-6 && t < endSeconds - 1e-6);
}
