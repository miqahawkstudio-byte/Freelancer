/**
 * placement.js — pure mapping from a BeatGrid to timeline marker placements.
 *
 * This is the bridge between the engine's output (BeatGrid, times in seconds
 * relative to the analyzed range) and the Premiere marker layer (ticks on the
 * sequence timeline). It stays pure so it is fully unit-testable without the
 * host.
 *
 * absoluteSeconds = beat.time + rangeStartSeconds + extraOffsetSeconds
 * ticks           = timelineTicksForSeconds(absoluteSeconds, zeroPointTicks, rate)
 *
 * where:
 *   - rangeStartSeconds: where the analyzed audio begins on the timeline,
 *     measured from the sequence zero point (0 for a whole-sequence manual grid).
 *   - extraOffsetSeconds: the First Beat Offset nudge (ms -> seconds).
 */

import { selectBeats } from './markerModes.js';
import { timelineTicksForSeconds } from '../premiere/Timecode.js';

/**
 * @param {import('./BeatGrid.js').BeatGrid} grid
 * @param {string} mode  a MarkerMode id
 * @param {{ ticksPerFrame:number, fps:number, nominalFps:number,
 *           zeroPointTicks:number, endTicks?:number }} seqInfo
 * @param {{ strongThreshold?:number, rangeStartSeconds?:number,
 *           extraOffsetSeconds?:number, clampToEnd?:boolean }} [opts]
 * @returns {Array<{ beat:import('./BeatGrid.js').Beat, ticks:number }>}
 */
export function computePlacements(grid, mode, seqInfo, opts = {}) {
  const {
    strongThreshold = 0.75,
    rangeStartSeconds = 0,
    extraOffsetSeconds = 0,
    clampToEnd = true,
  } = opts;

  const rate = {
    ticksPerFrame: seqInfo.ticksPerFrame,
    fps: seqInfo.fps,
    nominalFps: seqInfo.nominalFps,
  };
  const zero = seqInfo.zeroPointTicks;
  const end = seqInfo.endTicks;

  const selected = selectBeats(grid, mode, { strongThreshold });

  const seen = new Set();
  const placements = [];
  for (const beat of selected) {
    const abs = beat.time + rangeStartSeconds + extraOffsetSeconds;
    if (abs < 0) continue; // before the start of the sequence
    const ticks = timelineTicksForSeconds(abs, zero, rate);
    if (clampToEnd && end != null && ticks > end) continue; // past sequence end
    if (seen.has(ticks)) continue; // one marker per frame
    seen.add(ticks);
    placements.push({ beat, ticks });
  }
  placements.sort((a, b) => a.ticks - b.ticks);
  return placements;
}

/** Count how many markers each mode would create — for a UI preview. */
export function countByMode(grid, mode, seqInfo, opts = {}) {
  return computePlacements(grid, mode, seqInfo, opts).length;
}
