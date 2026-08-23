import { test, eq, near, assert } from './harness.mjs';
import { clickTrack, encodeWav16 } from './_signal.mjs';
import { analyzeAudio, decodeAudio } from '../src/engine/index.js';
import { decodeWav } from '../src/audio/WaveReader.js';

// Detect BPM within tolerance for a range of tempos (no genre assumptions).
for (const bpm of [90, 100, 120, 128, 140, 174]) {
  test(`detects ${bpm} BPM from a click track`, () => {
    const audio = clickTrack({ bpm, seconds: 10 });
    const grid = analyzeAudio(audio, { minBpm: 60, maxBpm: 200 });
    // Accept the true tempo or a clean harmonic; rounding should hit the target.
    const ok = Math.abs(grid.bpm - bpm) <= 2;
    assert(ok, `got ${grid.bpm}, expected ~${bpm}`);
  });
}

// Regression: on long signals the octave corrector must not halve/triplet the
// true tempo (the drift-free tempoScore fix). 160 and 174 were the failures.
for (const bpm of [160, 174]) {
  test(`does not drop to a subharmonic for ${bpm} BPM over 25s`, () => {
    const grid = analyzeAudio(clickTrack({ bpm, seconds: 25 }), { minBpm: 60, maxBpm: 200 });
    assert(Math.abs(grid.bpm - bpm) <= 2, `got ${grid.bpm} for ${bpm}`);
  });
}

test('firstBeat is near the start for an on-zero click track', () => {
  const audio = clickTrack({ bpm: 120, seconds: 8, offset: 0 });
  const grid = analyzeAudio(audio, { minBpm: 60, maxBpm: 200 });
  near(grid.firstBeat, 0, 0.05, `firstBeat ${grid.firstBeat}`);
});

test('beat count is roughly tempo*duration', () => {
  const audio = clickTrack({ bpm: 120, seconds: 10 });
  const grid = analyzeAudio(audio, { minBpm: 60, maxBpm: 200 });
  // 120 bpm over 10s ~ 20 beats; allow slack for edge frames.
  assert(grid.beats.length >= 17 && grid.beats.length <= 22, `beats=${grid.beats.length}`);
});

test('downbeats are a subset and every 4th beat in 4/4', () => {
  const audio = clickTrack({ bpm: 120, seconds: 12, accentEvery: 4 });
  const grid = analyzeAudio(audio, { minBpm: 60, maxBpm: 200 });
  eq(grid.meter, '4/4');
  assert(grid.downbeats.length >= 1, 'has downbeats');
  eq(grid.downbeats.every((t) => grid.beats.some((b) => b.time === t && b.type === 'downbeat')), true);
});

test('meterHint forces the reported meter (3/4 and 4/4)', () => {
  const audio = clickTrack({ bpm: 120, seconds: 12, accentEvery: 4 });
  const three = analyzeAudio(audio, { minBpm: 60, maxBpm: 200, meterHint: '3/4' });
  eq(three.meter, '3/4');
  const four = analyzeAudio(audio, { minBpm: 60, maxBpm: 200, meterHint: '4/4' });
  eq(four.meter, '4/4');
});

test('manual BPM bypasses tempo estimation', () => {
  const audio = clickTrack({ bpm: 128, seconds: 6 });
  const grid = analyzeAudio(audio, { manualBpm: 128 });
  eq(grid.bpm, 128);
});

test('confidence is high for a clean click track, low for noise', () => {
  const clean = analyzeAudio(clickTrack({ bpm: 128, seconds: 8 }), { minBpm: 60, maxBpm: 200 });
  const noise = new Float32Array(44100 * 4);
  for (let i = 0; i < noise.length; i++) noise[i] = (Math.random() * 2 - 1) * 0.3;
  const noisy = analyzeAudio({ samples: noise, sampleRate: 44100 }, { minBpm: 60, maxBpm: 200 });
  assert(clean.confidence > noisy.confidence, `clean ${clean.confidence} vs noise ${noisy.confidence}`);
});

test('WAV round-trip: encode 16-bit, decode, analyze via decodeAudio', () => {
  const { samples, sampleRate } = clickTrack({ bpm: 120, seconds: 6 });
  const wavBytes = encodeWav16(samples, sampleRate);
  const decoded = decodeWav(wavBytes);
  eq(decoded.sampleRate, 44100);
  near(decoded.durationSeconds, 6, 0.01);
  const audio = decodeAudio(wavBytes, 'song.wav');
  const grid = analyzeAudio(audio, { minBpm: 60, maxBpm: 200 });
  assert(Math.abs(grid.bpm - 120) <= 2, `got ${grid.bpm}`);
});

test('decodeAudio rejects mp3 with a clear engine-missing error (until native/wasm built)', () => {
  let threw = null;
  try {
    decodeAudio(new Uint8Array([0x49, 0x44, 0x33]), 'x.mp3');
  } catch (e) {
    threw = e;
  }
  assert(threw && /MP3/.test(threw.userMessage || threw.message), 'expected MP3 engine-missing error');
});
