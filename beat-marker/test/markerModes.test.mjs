import { test, eq } from './harness.mjs';
import { buildGridFromBpm } from '../src/beatGrid/BeatGrid.js';
import { selectBeats, MarkerMode, isValidMode } from '../src/beatGrid/markerModes.js';

const grid = buildGridFromBpm({ bpm: 120, firstBeat: 0, durationSeconds: 8, meter: '4/4' });
// 17 beats total (0..8s at 0.5s), 5 bars-worth of downbeats.

test('ALL_BEATS selects everything', () => {
  eq(selectBeats(grid, MarkerMode.ALL_BEATS).length, grid.beats.length);
});

test('DOWNBEATS selects only bar starts', () => {
  const d = selectBeats(grid, MarkerMode.DOWNBEATS);
  eq(d.every((b) => b.beatInBar === 1), true);
  eq(d.length, grid.downbeats.length);
});

test('EVERY_2_BEATS selects beats 1 and 3 of each bar', () => {
  const s = selectBeats(grid, MarkerMode.EVERY_2_BEATS);
  eq(s.every((b) => b.beatInBar === 1 || b.beatInBar === 3), true);
});

test('EVERY_4_BEATS equals downbeats in 4/4', () => {
  const s = selectBeats(grid, MarkerMode.EVERY_4_BEATS);
  eq(s.every((b) => b.beatInBar === 1), true);
});

test('STRONG_BEATS includes downbeats via threshold', () => {
  const s = selectBeats(grid, MarkerMode.STRONG_BEATS, { strongThreshold: 0.75 });
  // downbeats have strength 1 -> always included
  eq(s.some((b) => b.type === 'downbeat'), true);
});

test('isValidMode guards unknown modes', () => {
  eq(isValidMode('DOWNBEATS'), true);
  eq(isValidMode('NOPE'), false);
});
