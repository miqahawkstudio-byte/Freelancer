/**
 * waveformPeaks.js — downsample audio to per-bucket min/max peaks for drawing.
 * Pure, no host/UI. The panel renders these on a Canvas with beat overlays.
 */

/**
 * @param {Float32Array} samples mono
 * @param {number} buckets number of horizontal pixels/columns to draw
 * @returns {{ mins:Float32Array, maxs:Float32Array, buckets:number }}
 */
export function computePeaks(samples, buckets) {
  const b = Math.max(1, Math.floor(buckets));
  const mins = new Float32Array(b);
  const maxs = new Float32Array(b);
  const n = samples.length;
  if (n === 0) return { mins, maxs, buckets: b };

  for (let i = 0; i < b; i++) {
    const start = Math.floor((i * n) / b);
    const end = Math.max(start + 1, Math.floor(((i + 1) * n) / b));
    let mn = Infinity;
    let mx = -Infinity;
    for (let j = start; j < end && j < n; j++) {
      const v = samples[j];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    mins[i] = mn === Infinity ? 0 : mn;
    maxs[i] = mx === -Infinity ? 0 : mx;
  }
  return { mins, maxs, buckets: b };
}
