import { test, eq, assert } from './harness.mjs';
import { clickTrack } from './_signal.mjs';
import { fingerprint, optionsKey } from '../src/analysis/fingerprint.js';
import { Analyzer } from '../src/analysis/Analyzer.js';

test('fingerprint is stable for identical audio and differs for different audio', () => {
  const a = clickTrack({ bpm: 120, seconds: 5 });
  const b = clickTrack({ bpm: 140, seconds: 5 });
  const fa1 = fingerprint(a.samples, a.sampleRate);
  const fa2 = fingerprint(a.samples, a.sampleRate);
  const fb = fingerprint(b.samples, b.sampleRate);
  eq(fa1, fa2);
  assert(fa1 !== fb, 'different content -> different fingerprint');
});

test('optionsKey separates different analysis options', () => {
  assert(optionsKey({ minBpm: 60, maxBpm: 200 }) !== optionsKey({ minBpm: 40, maxBpm: 220 }));
});

test('Analyzer caches: second identical analyze is a hit and skips recompute', () => {
  let computes = 0;
  const fakeAnalyze = () => {
    computes++;
    return { bpm: 120, meter: '4/4', confidence: 1, firstBeat: 0, beats: [], downbeats: [] };
  };
  const az = new Analyzer({ analyzeFn: fakeAnalyze });
  const audio = clickTrack({ bpm: 120, seconds: 5 });

  const r1 = az.analyze(audio, { minBpm: 60, maxBpm: 200 });
  const r2 = az.analyze(audio, { minBpm: 60, maxBpm: 200 });
  eq(r1.cached, false);
  eq(r2.cached, true);
  eq(computes, 1, 'compute happened only once');
  eq(az.stats.hits, 1);
});

test('different options bypass the cache', () => {
  let computes = 0;
  const az = new Analyzer({
    analyzeFn: () => {
      computes++;
      return { bpm: 1, meter: '4/4', confidence: 1, firstBeat: 0, beats: [], downbeats: [] };
    },
  });
  const audio = clickTrack({ bpm: 120, seconds: 4 });
  az.analyze(audio, { sensitivity: 0.5 });
  az.analyze(audio, { sensitivity: 0.8 });
  eq(computes, 2);
});

test('cache respects maxEntries (LRU eviction)', () => {
  const az = new Analyzer({ maxEntries: 2, analyzeFn: () => ({ bpm: 1, beats: [] }) });
  az.analyze(clickTrack({ bpm: 90, seconds: 2 }), {});
  az.analyze(clickTrack({ bpm: 100, seconds: 2 }), {});
  az.analyze(clickTrack({ bpm: 110, seconds: 2 }), {}); // evicts the 90 entry
  eq(az.map.size, 2);
});

test('disabled cache always computes', () => {
  let computes = 0;
  const az = new Analyzer({ enabled: false, analyzeFn: () => (computes++, { beats: [] }) });
  const audio = clickTrack({ bpm: 120, seconds: 3 });
  az.analyze(audio, {});
  az.analyze(audio, {});
  eq(computes, 2);
});
