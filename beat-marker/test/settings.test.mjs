import { test, eq, assert } from './harness.mjs';
import { SettingsStore, DEFAULTS, memoryBackend } from '../src/settings/SettingsStore.js';

test('fresh store returns defaults', () => {
  const s = new SettingsStore(memoryBackend());
  s.load();
  eq(s.get('defaultMarkerMode'), 'STRONG_BEATS');
  eq(s.get('sensitivity'), 50);
  eq(s.get('keepTemp'), false);
});

test('set persists and reloads', () => {
  const backend = memoryBackend();
  const a = new SettingsStore(backend);
  a.load();
  a.set('sensitivity', 70);
  a.set({ keepTemp: true, pcmWavPreset: 'C:/presets/wav.epr' });

  const b = new SettingsStore(backend);
  b.load();
  eq(b.get('sensitivity'), 70);
  eq(b.get('keepTemp'), true);
  eq(b.get('pcmWavPreset'), 'C:/presets/wav.epr');
});

test('unknown keys are dropped; missing keys filled from defaults', () => {
  const backend = memoryBackend();
  backend.setItem('beatMarker.settings', JSON.stringify({ sensitivity: 33, bogus: 'x' }));
  const s = new SettingsStore(backend);
  s.load();
  eq(s.get('sensitivity'), 33);
  eq('bogus' in s.all(), false);
  eq(s.get('defaultMeter'), DEFAULTS.defaultMeter);
});

test('corrupt blob falls back to defaults', () => {
  const backend = memoryBackend();
  backend.setItem('beatMarker.settings', '{not json');
  const s = new SettingsStore(backend);
  s.load();
  eq(s.get('sensitivity'), 50);
});

test('type coercion keeps booleans and numbers well-typed', () => {
  const s = new SettingsStore(memoryBackend());
  s.load();
  s.set('keepTemp', 'yes'); // truthy string -> true
  s.set('sensitivity', '80'); // numeric string -> number
  eq(s.get('keepTemp'), true);
  eq(s.get('sensitivity'), 80);
  assert(typeof s.get('sensitivity') === 'number');
});
