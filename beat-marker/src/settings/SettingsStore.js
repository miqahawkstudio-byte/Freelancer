/**
 * SettingsStore.js — local, persisted user settings with safe defaults.
 *
 * Backend-agnostic so it is unit-testable: pass any { getItem, setItem } store
 * (localStorage in UXP, an in-memory object in tests). Unknown keys are dropped
 * and missing keys are filled from DEFAULTS on load, so a stale or corrupt blob
 * can never break the panel.
 */

export const DEFAULTS = Object.freeze({
  defaultBpm: 'auto', // 'auto' or a number
  defaultMeter: 'auto', // 'auto' | '4/4' | '3/4'
  sensitivity: 50, // 0..100
  defaultMarkerMode: 'STRONG_BEATS',
  firstBeatOffsetMs: 0,
  keepTemp: false,
  cacheEnabled: true,
  devMode: false,
  pcmWavPreset: '', // path to a PCM WAV .epr export preset
});

const STORAGE_KEY = 'beatMarker.settings';

export class SettingsStore {
  /** @param {{ getItem:(k:string)=>?string, setItem:(k:string,v:string)=>void }} backend */
  constructor(backend) {
    this.backend = backend || memoryBackend();
    this.values = { ...DEFAULTS };
  }

  /** Load and merge persisted values over the defaults. Never throws. */
  load() {
    try {
      const raw = this.backend.getItem(STORAGE_KEY);
      if (raw) this.values = mergeKnown(DEFAULTS, JSON.parse(raw));
    } catch {
      this.values = { ...DEFAULTS };
    }
    return this.values;
  }

  get(key) {
    return this.values[key];
  }

  all() {
    return { ...this.values };
  }

  /** Set one or many values (validated), then persist. */
  set(patch, value) {
    const updates = typeof patch === 'string' ? { [patch]: value } : patch;
    for (const [k, v] of Object.entries(updates)) {
      if (k in DEFAULTS) this.values[k] = coerce(k, v);
    }
    this.save();
    return this.values;
  }

  save() {
    try {
      this.backend.setItem(STORAGE_KEY, JSON.stringify(this.values));
    } catch {
      /* storage unavailable — keep in-memory values */
    }
  }

  reset() {
    this.values = { ...DEFAULTS };
    this.save();
    return this.values;
  }
}

/** Merge only keys present in DEFAULTS, coercing types. */
function mergeKnown(defaults, incoming) {
  const out = { ...defaults };
  if (incoming && typeof incoming === 'object') {
    for (const k of Object.keys(defaults)) {
      if (k in incoming) out[k] = coerce(k, incoming[k]);
    }
  }
  return out;
}

/** Light type coercion so persisted strings/numbers stay well-typed. */
function coerce(key, v) {
  const def = DEFAULTS[key];
  if (typeof def === 'boolean') return !!v;
  if (typeof def === 'number') {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }
  return v; // strings and 'auto'-or-number fields pass through
}

/** In-memory backend for tests / non-UXP preview. */
export function memoryBackend() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}
