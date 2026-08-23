/**
 * exportGrid.js — serialize a BeatGrid to JSON or CSV. Pure, no host/UI.
 *
 * Groundwork for the V2 "export beat grid" feature and for interop with other
 * tools. When `seqInfo` (+ optional `rangeStartSeconds`) is supplied, each beat
 * also gets its absolute timeline timecode, so the export lines up with the
 * markers created in Premiere.
 */

import { secondsToFrames, framesToTimecode } from '../premiere/Timecode.js';

/**
 * @param {import('./BeatGrid.js').BeatGrid} grid
 * @param {{ seqInfo?:object, rangeStartSeconds?:number, pretty?:boolean }} [opts]
 * @returns {string} JSON
 */
export function gridToJSON(grid, opts = {}) {
  const { seqInfo, rangeStartSeconds = 0, pretty = true } = opts;
  const tc = timecoder(seqInfo, rangeStartSeconds);
  const out = {
    bpm: grid.bpm,
    meter: grid.meter,
    confidence: grid.confidence,
    firstBeat: grid.firstBeat,
    beatCount: grid.beats.length,
    beats: grid.beats.map((b) => (tc ? { ...b, timelineTimecode: tc(b.time) } : { ...b })),
    downbeats: grid.downbeats,
  };
  return JSON.stringify(out, null, pretty ? 2 : 0);
}

/**
 * @param {import('./BeatGrid.js').BeatGrid} grid
 * @param {{ seqInfo?:object, rangeStartSeconds?:number }} [opts]
 * @returns {string} CSV with a header row
 */
export function gridToCSV(grid, opts = {}) {
  const { seqInfo, rangeStartSeconds = 0 } = opts;
  const tc = timecoder(seqInfo, rangeStartSeconds);
  const header = ['index', 'bar', 'beatInBar', 'type', 'timeSeconds', 'strength'];
  if (tc) header.push('timelineTimecode');

  const rows = [header.join(',')];
  for (const b of grid.beats) {
    const row = [b.index, b.bar, b.beatInBar, b.type, fmt(b.time), fmt(b.strength)];
    if (tc) row.push(tc(b.time));
    rows.push(row.join(','));
  }
  return rows.join('\n');
}

/** Build an absolute-timecode function from sequence info, or null. */
function timecoder(seqInfo, rangeStartSeconds) {
  if (!seqInfo || seqInfo.ticksPerFrame == null) return null;
  const zeroFrame = seqInfo.zeroPointTicks / seqInfo.ticksPerFrame;
  return (t) => {
    const frame = secondsToFrames(t + rangeStartSeconds, seqInfo) + zeroFrame;
    return framesToTimecode(frame, seqInfo, !!seqInfo.dropFrame);
  };
}

function fmt(n) {
  return String(Math.round(n * 1e6) / 1e6);
}
