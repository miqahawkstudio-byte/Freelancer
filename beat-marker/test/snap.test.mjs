import { test, eq, near, assert } from './harness.mjs';
import { buildGridFromBpm } from '../src/beatGrid/BeatGrid.js';
import { MarkerMode } from '../src/beatGrid/markerModes.js';
import { beatTimes, nearestInSorted, snapTime, snapTimes, cutPointsInRange } from '../src/beatGrid/snap.js';

// 120 BPM 4/4 over 8s -> beats at 0,0.5,1.0,...; downbeats at 0,2,4,6,8.
const grid = buildGridFromBpm({ bpm: 120, firstBeat: 0, durationSeconds: 8, meter: '4/4' });

test('nearestInSorted finds the closest value and handles ends', () => {
  const arr = [0, 0.5, 1.0, 1.5, 2.0];
  eq(nearestInSorted(arr, 0.6), 0.5);
  eq(nearestInSorted(arr, 0.8), 1.0);
  eq(nearestInSorted(arr, -1), 0);
  eq(nearestInSorted(arr, 99), 2.0);
  eq(nearestInSorted([], 1), null);
});

test('beatTimes respects mode (downbeats every 2s)', () => {
  const d = beatTimes(grid, MarkerMode.DOWNBEATS);
  eq(d[0], 0);
  near(d[1], 2, 1e-9);
  near(d[2], 4, 1e-9);
});

test('snapTime snaps to nearest beat', () => {
  const r = snapTime(1.23, grid, { mode: MarkerMode.ALL_BEATS });
  near(r.time, 1.0, 1e-9); // 1.23 -> nearest beat 1.0
  near(r.delta, -0.23, 1e-6);
  eq(r.snapped, true);
});

test('snapTime respects maxDistanceSeconds (leaves far points alone)', () => {
  // Snap to downbeats (every 2s); 0.9 is 0.9 from 0 and 1.1 from 2 -> nearest 0,
  // distance 0.9 > 0.2 tolerance -> not snapped.
  const r = snapTime(0.9, grid, { mode: MarkerMode.DOWNBEATS, maxDistanceSeconds: 0.2 });
  eq(r.snapped, false);
  eq(r.time, 0.9);
});

test('snapTimes maps many clip edit points, preserving order', () => {
  const res = snapTimes([0.1, 2.4, 5.9], grid, { mode: MarkerMode.DOWNBEATS });
  eq(res.length, 3);
  near(res[0].time, 0, 1e-9);
  near(res[1].time, 2, 1e-9);
  near(res[2].time, 6, 1e-9);
  eq(res.every((r) => r.snapped), true);
});

test('cutPointsInRange returns interior beats only (Cut on Beat)', () => {
  // Downbeats at 0,2,4,6,8; interior of [1,7] -> 2,4,6.
  const cuts = cutPointsInRange(grid, 1, 7, { mode: MarkerMode.DOWNBEATS });
  eq(cuts.length, 3);
  near(cuts[0], 2, 1e-9);
  near(cuts[2], 6, 1e-9);
  // Boundaries excluded: a range exactly on beats [2,6] yields only 4.
  const cuts2 = cutPointsInRange(grid, 2, 6, { mode: MarkerMode.DOWNBEATS });
  eq(cuts2.length, 1);
  near(cuts2[0], 4, 1e-9);
});

test('every-beat cut points are denser than downbeat cut points', () => {
  const all = cutPointsInRange(grid, 0, 8, { mode: MarkerMode.ALL_BEATS });
  const down = cutPointsInRange(grid, 0, 8, { mode: MarkerMode.DOWNBEATS });
  assert(all.length > down.length, `${all.length} vs ${down.length}`);
});
