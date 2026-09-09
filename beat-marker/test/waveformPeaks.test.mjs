import { test, eq, near, assert } from './harness.mjs';
import { computePeaks } from '../src/audio/waveformPeaks.js';

test('computePeaks returns the requested bucket count', () => {
  const s = new Float32Array(1000).fill(0.5);
  const p = computePeaks(s, 100);
  eq(p.buckets, 100);
  eq(p.mins.length, 100);
  eq(p.maxs.length, 100);
});

test('constant signal has min==max per bucket', () => {
  const s = new Float32Array(500).fill(0.3);
  const p = computePeaks(s, 50);
  for (let i = 0; i < 50; i++) {
    near(p.mins[i], 0.3, 1e-6);
    near(p.maxs[i], 0.3, 1e-6);
  }
});

test('captures the full-scale peaks of a sine', () => {
  const n = 44100;
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
  const p = computePeaks(s, 200);
  // Somewhere the peaks should reach near +/-1.
  assert(Math.max(...p.maxs) > 0.95, 'max near +1');
  assert(Math.min(...p.mins) < -0.95, 'min near -1');
});

test('empty input yields zeroed peaks, not a crash', () => {
  const p = computePeaks(new Float32Array(0), 10);
  eq(p.buckets, 10);
  eq(p.maxs.every((v) => v === 0), true);
});
