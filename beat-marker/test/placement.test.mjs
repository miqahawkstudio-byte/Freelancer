import { test, eq, near } from './harness.mjs';
import { buildGridFromBpm } from '../src/beatGrid/BeatGrid.js';
import { MarkerMode } from '../src/beatGrid/markerModes.js';
import { computePlacements } from '../src/beatGrid/placement.js';
import { resolveRate, ticksToSeconds } from '../src/premiere/Timecode.js';

// A 25fps sequence starting at 01:00:00:00.
const rate = resolveRate({ fps: 25 });
const seqInfo = {
  ticksPerFrame: rate.ticksPerFrame,
  fps: rate.fps,
  nominalFps: rate.nominalFps,
  zeroPointTicks: 25 * 3600 * rate.ticksPerFrame, // 1 hour
  endTicks: 25 * 3600 * rate.ticksPerFrame + 25 * 20 * rate.ticksPerFrame, // +20s
};

const grid = buildGridFromBpm({ bpm: 120, firstBeat: 0, durationSeconds: 20, meter: '4/4' });

test('downbeats map onto exact frames past the 1-hour start', () => {
  const p = computePlacements(grid, MarkerMode.DOWNBEATS, seqInfo);
  // First downbeat at t=0 -> exactly the zero point.
  eq(p[0].ticks, seqInfo.zeroPointTicks);
  // Second downbeat at t=2s (120bpm, 4/4) -> +2s in absolute terms.
  near(ticksToSeconds(p[1].ticks - seqInfo.zeroPointTicks), 2, 0.0005);
});

test('every beat lands on a frame boundary (integer frame offset)', () => {
  const p = computePlacements(grid, MarkerMode.ALL_BEATS, seqInfo);
  for (const { ticks } of p) {
    const frameOffset = (ticks - seqInfo.zeroPointTicks) / seqInfo.ticksPerFrame;
    eq(Number.isInteger(frameOffset), true, `non-integer frame at ${ticks}`);
  }
});

test('placements are sorted and unique per frame', () => {
  const p = computePlacements(grid, MarkerMode.ALL_BEATS, seqInfo);
  for (let i = 1; i < p.length; i++) {
    eq(p[i].ticks > p[i - 1].ticks, true, 'strictly increasing ticks');
  }
});

test('clampToEnd drops beats past the sequence end', () => {
  // Grid longer than the 20s sequence window.
  const longGrid = buildGridFromBpm({ bpm: 120, firstBeat: 0, durationSeconds: 60, meter: '4/4' });
  const p = computePlacements(longGrid, MarkerMode.DOWNBEATS, seqInfo, { clampToEnd: true });
  const last = ticksToSeconds(p[p.length - 1].ticks - seqInfo.zeroPointTicks);
  eq(last <= 20.0001, true, `last downbeat ${last}s should be within 20s`);
});

test('extraOffsetSeconds shifts every placement', () => {
  const base = computePlacements(grid, MarkerMode.DOWNBEATS, seqInfo);
  const shifted = computePlacements(grid, MarkerMode.DOWNBEATS, seqInfo, {
    extraOffsetSeconds: 0.04, // +40ms -> 1 frame @25fps
  });
  eq(shifted[0].ticks - base[0].ticks, seqInfo.ticksPerFrame, 'shift by exactly 1 frame');
});

test('rangeStartSeconds anchors an analyzed clip later on the timeline', () => {
  // Audio that starts 5s into the sequence.
  const p = computePlacements(grid, MarkerMode.DOWNBEATS, seqInfo, { rangeStartSeconds: 5 });
  near(ticksToSeconds(p[0].ticks - seqInfo.zeroPointTicks), 5, 0.0005);
});
