import { test, eq, near, assert } from './harness.mjs';
import { clickTrack } from './_signal.mjs';
import { assembleTrackAudio, resampleLinear } from '../src/engine/timelineAssemble.js';
import { analyzeAudio } from '../src/engine/index.js';

test('assembles two clips with a gap; no beats fall in the gap', () => {
  // Clip A: timeline 2..6s, Clip B: timeline 8..12s. Gap 6..8s (range-rel 4..6s).
  const a = clickTrack({ bpm: 120, seconds: 4 });
  const b = clickTrack({ bpm: 120, seconds: 4 });
  const asm = assembleTrackAudio([
    { startSeconds: 2, samples: a.samples, sampleRate: 44100 },
    { startSeconds: 8, samples: b.samples, sampleRate: 44100 },
  ]);
  eq(asm.rangeStartSeconds, 2);
  near(asm.spanSeconds, 10, 0.01);

  // The gap is range-relative 4..6s.
  assert(asm.gaps.some(([s, e]) => Math.abs(s - 4) < 0.05 && Math.abs(e - 6) < 0.05), `gaps=${JSON.stringify(asm.gaps)}`);

  const grid = analyzeAudio({ samples: asm.samples, sampleRate: asm.sampleRate }, { minBpm: 60, maxBpm: 200 });
  assert(Math.abs(grid.bpm - 120) <= 2, `bpm ${grid.bpm}`);
  // No beat should sit inside the silent gap (allow a small guard band).
  const inGap = grid.beats.filter((bt) => bt.time > 4.15 && bt.time < 5.85);
  eq(inGap.length, 0, `unexpected beats in gap: ${inGap.map((x) => x.time).join(',')}`);
  // But beats exist before and after the gap.
  assert(grid.beats.some((bt) => bt.time < 4) && grid.beats.some((bt) => bt.time > 6), 'beats around the gap');
});

test('resampleLinear preserves tempo (48k -> 44.1k)', () => {
  const src = clickTrack({ bpm: 128, seconds: 6, sampleRate: 48000 });
  const rs = resampleLinear(src.samples, 48000, 44100);
  near(rs.length / 44100, 6, 0.01);
  const grid = analyzeAudio({ samples: rs, sampleRate: 44100 }, { minBpm: 60, maxBpm: 200 });
  assert(Math.abs(grid.bpm - 128) <= 2, `bpm ${grid.bpm}`);
});

test('assembleTrackAudio mixes differing sample rates onto a common rate', () => {
  const a = clickTrack({ bpm: 120, seconds: 3, sampleRate: 48000 });
  const b = clickTrack({ bpm: 120, seconds: 3, sampleRate: 44100 });
  const asm = assembleTrackAudio(
    [
      { startSeconds: 0, samples: a.samples, sampleRate: 48000 },
      { startSeconds: 4, samples: b.samples, sampleRate: 44100 },
    ],
    { targetRate: 48000 }
  );
  eq(asm.sampleRate, 48000);
  near(asm.spanSeconds, 7, 0.02);
});

test('empty clip list yields empty buffer', () => {
  const asm = assembleTrackAudio([]);
  eq(asm.samples.length, 0);
  eq(asm.gaps.length, 0);
});
