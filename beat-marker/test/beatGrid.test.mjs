import { test, eq, near, assert } from './harness.mjs';
import {
  buildGridFromBpm,
  shiftGrid,
  beatsPerBar,
  validateGrid,
} from '../src/beatGrid/BeatGrid.js';

test('beatsPerBar parses meters', () => {
  eq(beatsPerBar('4/4'), 4);
  eq(beatsPerBar('3/4'), 3);
  eq(beatsPerBar('7/8'), 7);
});

test('buildGridFromBpm 120bpm 4/4 gives 2 beats/sec', () => {
  const g = buildGridFromBpm({ bpm: 120, firstBeat: 0, durationSeconds: 4, meter: '4/4' });
  // 120 bpm -> 0.5s period; 0..4s inclusive -> 9 beats.
  eq(g.beats.length, 9);
  near(g.beats[1].time, 0.5, 1e-6);
  eq(g.beats[0].type, 'downbeat');
  eq(g.beats[4].type, 'downbeat'); // beat index 5 = bar 2 beat 1
  eq(g.downbeats.length, 3);
});

test('bar and beatInBar numbering in 3/4', () => {
  const g = buildGridFromBpm({ bpm: 60, firstBeat: 0, durationSeconds: 6, meter: '3/4' });
  eq(g.beats[0].beatInBar, 1);
  eq(g.beats[2].beatInBar, 3);
  eq(g.beats[3].beatInBar, 1);
  eq(g.beats[3].bar, 2);
});

test('shiftGrid moves first beat and keeps spacing', () => {
  const g = buildGridFromBpm({ bpm: 120, firstBeat: 1.0, durationSeconds: 2, meter: '4/4' });
  const s = shiftGrid(g, 1.25);
  near(s.firstBeat, 1.25, 1e-9);
  near(s.beats[0].time, 1.25, 1e-6);
  near(s.beats[1].time - s.beats[0].time, 0.5, 1e-6);
});

test('validateGrid enforces monotonic beats', () => {
  const g = buildGridFromBpm({ bpm: 128, firstBeat: 0.1, durationSeconds: 10, meter: '4/4' });
  assert(validateGrid(g));
});
