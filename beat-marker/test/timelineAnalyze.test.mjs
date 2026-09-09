import { test, eq, near, assert } from './harness.mjs';
import { clickTrack, encodeWav16 } from './_signal.mjs';
import { analyzeClipBuffers, analyzeWavBuffer } from '../src/engine/timelineAnalyze.js';

test('analyzeClipBuffers: two rendered clips with a gap -> one grid, no gap beats', () => {
  const a = clickTrack({ bpm: 120, seconds: 4 });
  const b = clickTrack({ bpm: 120, seconds: 4 });
  const clips = [
    { startSeconds: 2, buffer: encodeWav16(a.samples, 44100) },
    { startSeconds: 8, buffer: encodeWav16(b.samples, 44100) },
  ];
  const { grid, rangeStartSeconds, gaps } = analyzeClipBuffers(clips, { minBpm: 60, maxBpm: 200 });
  eq(rangeStartSeconds, 2);
  assert(Math.abs(grid.bpm - 120) <= 2, `bpm ${grid.bpm}`);
  assert(gaps.some(([s, e]) => Math.abs(s - 4) < 0.1 && Math.abs(e - 6) < 0.1), 'gap detected');
  const inGap = grid.beats.filter((bt) => bt.time > 4.15 && bt.time < 5.85);
  eq(inGap.length, 0, 'no beats inside the silent gap');
});

test('analyzeWavBuffer: single rendered mix -> grid with detected tempo', () => {
  const mix = clickTrack({ bpm: 128, seconds: 8 });
  const { grid, durationSeconds } = analyzeWavBuffer(encodeWav16(mix.samples, 44100), {
    minBpm: 60,
    maxBpm: 200,
  });
  near(durationSeconds, 8, 0.02);
  assert(Math.abs(grid.bpm - 128) <= 2, `bpm ${grid.bpm}`);
});
