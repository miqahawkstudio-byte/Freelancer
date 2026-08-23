import { test, eq, near, assert } from './harness.mjs';
import { segments } from './_signal.mjs';
import { energyEnvelope, detectSilence, detectEnergyChanges } from '../src/engine/sections.js';

test('energyEnvelope tracks amplitude sections', () => {
  const { samples, sampleRate } = segments({ parts: [{ seconds: 2, amp: 0.1 }, { seconds: 2, amp: 0.8 }] });
  const { energy, fps } = energyEnvelope(samples, sampleRate);
  near(fps, 44100 / 1024, 1);
  const quiet = energy[Math.floor(1 * fps)];
  const loud = energy[Math.floor(3 * fps)];
  assert(loud > quiet * 3, `loud ${loud} should dwarf quiet ${quiet}`);
});

test('detectEnergyChanges finds a rise at a quiet->loud boundary', () => {
  const { samples, sampleRate } = segments({ parts: [{ seconds: 4, amp: 0.05 }, { seconds: 4, amp: 0.6 }] });
  const { energy, fps } = energyEnvelope(samples, sampleRate);
  const events = detectEnergyChanges(energy, fps);
  const rise = events.find((e) => e.type === 'rise');
  assert(rise, `expected a rise, got ${JSON.stringify(events)}`);
  near(rise.time, 4, 0.8);
});

test('detectEnergyChanges finds a drop at a loud->quiet boundary', () => {
  const { samples, sampleRate } = segments({ parts: [{ seconds: 4, amp: 0.6 }, { seconds: 4, amp: 0.05 }] });
  const { energy, fps } = energyEnvelope(samples, sampleRate);
  const events = detectEnergyChanges(energy, fps);
  const drop = events.find((e) => e.type === 'drop');
  assert(drop, `expected a drop, got ${JSON.stringify(events)}`);
  near(drop.time, 4, 0.8);
});

test('detectSilence finds an interior silent gap', () => {
  const { samples, sampleRate } = segments({
    parts: [{ seconds: 2, amp: 0.5 }, { seconds: 1, amp: 0 }, { seconds: 2, amp: 0.5 }],
  });
  const { energy, fps } = energyEnvelope(samples, sampleRate);
  const regions = detectSilence(energy, fps, { threshold: 0.02, minDurationSeconds: 0.3 });
  assert(regions.length >= 1, 'found a silent region');
  const [s, e] = regions[0];
  assert(s > 1.5 && e < 3.5, `silence around 2..3s, got ${s}..${e}`);
});

test('steady signal produces no spurious section changes', () => {
  const { samples, sampleRate } = segments({ parts: [{ seconds: 8, amp: 0.4 }] });
  const { energy, fps } = energyEnvelope(samples, sampleRate);
  const events = detectEnergyChanges(energy, fps, { minJumpRatio: 0.25 });
  eq(events.length, 0);
});
