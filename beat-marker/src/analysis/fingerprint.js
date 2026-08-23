/**
 * fingerprint.js — fast, stable content hash of decoded audio. Pure, no deps.
 *
 * Used as a cache key so re-analyzing the same material is instant. We do NOT
 * store audio anywhere — only this compact fingerprint plus the resulting
 * BeatGrid (see analysis/Cache.js). The hash samples the buffer at a fixed
 * stride (so cost is bounded regardless of length) and folds in duration and
 * sample rate.
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * @param {Float32Array} samples mono
 * @param {number} sampleRate
 * @param {number} [durationSeconds] optional; derived from samples if omitted
 * @returns {string} hex fingerprint, e.g. "8a72f13c"
 */
export function fingerprint(samples, sampleRate, durationSeconds) {
  const n = samples.length;
  const dur = durationSeconds ?? n / sampleRate;

  let h = FNV_OFFSET >>> 0;
  h = mix(h, Math.round(sampleRate));
  h = mix(h, Math.round(dur * 1000));
  h = mix(h, n);

  // Sample ~4096 points evenly across the buffer; quantize to be robust to tiny
  // float noise while still distinguishing different content.
  const points = Math.min(4096, n);
  const stride = points > 0 ? Math.max(1, Math.floor(n / points)) : 1;
  for (let i = 0; i < n; i += stride) {
    h = mix(h, Math.round(samples[i] * 1000));
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Combine analysis options into the cache key (tempo range, sensitivity, ...). */
export function optionsKey(options = {}) {
  const { minBpm = 40, maxBpm = 220, sensitivity = 0.5, manualBpm = 0, meterHint = 'auto' } = options;
  return [minBpm, maxBpm, round(sensitivity), round(manualBpm), meterHint].join(':');
}

function mix(h, value) {
  h ^= value & 0xffffffff;
  h = Math.imul(h, FNV_PRIME);
  return h >>> 0;
}
function round(n) {
  return Math.round(Number(n) * 1000) / 1000;
}
