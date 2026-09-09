/**
 * Analyzer.js — analyzeAudio() with a content-addressed result cache.
 *
 * Re-analyzing the same audio with the same options returns the stored BeatGrid
 * instantly instead of recomputing. The cache stores only the fingerprint +
 * grid metadata (never the audio). Backend-agnostic and bounded in size, so it
 * is unit-testable and safe to back with localStorage in UXP.
 */

import { analyzeAudio } from '../engine/index.js';
import { fingerprint, optionsKey } from './fingerprint.js';

export class Analyzer {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.maxEntries=32]
   * @param {boolean} [opts.enabled=true]
   * @param {(audio, options)=>object} [opts.analyzeFn] injectable (tests)
   */
  constructor({ maxEntries = 32, enabled = true, analyzeFn = analyzeAudio } = {}) {
    this.maxEntries = maxEntries;
    this.enabled = enabled;
    this.analyzeFn = analyzeFn;
    this.map = new Map(); // key -> grid (insertion order = LRU-ish)
    this.stats = { hits: 0, misses: 0, computes: 0 };
  }

  key(audio, options) {
    return `${fingerprint(audio.samples, audio.sampleRate, audio.durationSeconds)}|${optionsKey(options)}`;
  }

  /**
   * Return the BeatGrid for `audio`, using the cache when enabled.
   * @returns {{ grid:object, cached:boolean }}
   */
  analyze(audio, options = {}) {
    if (!this.enabled) {
      this.stats.computes++;
      return { grid: this.analyzeFn(audio, options), cached: false };
    }
    const k = this.key(audio, options);
    if (this.map.has(k)) {
      const grid = this.map.get(k);
      this.map.delete(k);
      this.map.set(k, grid); // refresh recency
      this.stats.hits++;
      return { grid, cached: true };
    }
    this.stats.misses++;
    this.stats.computes++;
    const grid = this.analyzeFn(audio, options);
    this.store(k, grid);
    return { grid, cached: false };
  }

  store(key, grid) {
    this.map.set(key, grid);
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }

  clear() {
    this.map.clear();
    this.stats = { hits: 0, misses: 0, computes: 0 };
  }
}
