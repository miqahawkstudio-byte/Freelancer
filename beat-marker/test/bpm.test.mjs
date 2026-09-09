import { test, eq, assert } from './harness.mjs';
import { harmonicCandidates, correctOctave, combAgreement } from '../src/beatGrid/bpm.js';

test('harmonicCandidates folds 64 -> includes 64 and 128', () => {
  const c = harmonicCandidates(64);
  assert(c.includes(64), 'has 64');
  assert(c.includes(128), 'has 128');
});

test('combAgreement is high when onsets sit on the beat', () => {
  // Onsets exactly on 128 BPM grid (period 0.46875s).
  const period = 60 / 128;
  const onsets = Array.from({ length: 32 }, (_, i) => i * period);
  const good = combAgreement(onsets, 128);
  const bad = combAgreement(onsets, 100);
  assert(good > bad, `expected 128 to fit better than 100 (got ${good} vs ${bad})`);
  assert(good > 0.8, `expected strong fit, got ${good}`);
});

test('correctOctave picks 128 over 64 using onset evidence', () => {
  // A real 128 BPM track: detector reports the half-tempo 64.
  const period = 60 / 128;
  const onsets = Array.from({ length: 64 }, (_, i) => i * period);
  const { bpm } = correctOctave(64, { onsets });
  eq(bpm, 128);
});

test('correctOctave does not force doubling without evidence', () => {
  // Onsets truly at 64 BPM -> should stay near 64, not jump to 128.
  const period = 60 / 64;
  const onsets = Array.from({ length: 40 }, (_, i) => i * period);
  const { bpm } = correctOctave(64, { onsets });
  eq(bpm, 64);
});

test('174 stays 174 (drum & bass tempo), not halved, given matching onsets', () => {
  const period = 60 / 174;
  const onsets = Array.from({ length: 80 }, (_, i) => i * period);
  const { bpm } = correctOctave(174, { onsets });
  eq(bpm, 174);
});
