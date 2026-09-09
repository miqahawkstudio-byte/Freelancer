/**
 * fft.js — minimal in-place iterative radix-2 Cooley-Tukey FFT. Pure JS, no deps.
 *
 * Used by the onset-detection front end. Sizes must be powers of two.
 */

/**
 * In-place complex FFT.
 * @param {Float64Array} re real parts (length N, power of 2)
 * @param {Float64Array} im imaginary parts (length N)
 */
export function fft(re, im) {
  const n = re.length;
  if (n <= 1) return;
  if ((n & (n - 1)) !== 0) throw new RangeError(`FFT size must be a power of 2, got ${n}`);

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  // Danielson-Lanczos.
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wpr = Math.cos(ang);
    const wpi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wr = 1;
      let wi = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = i + k + len / 2;
        const tr = wr * re[b] - wi * im[b];
        const ti = wr * im[b] + wi * re[b];
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nwr = wr * wpr - wi * wpi;
        wi = wr * wpi + wi * wpr;
        wr = nwr;
      }
    }
  }
}

/**
 * Magnitude spectrum of a real, already-windowed frame.
 * @param {Float64Array} frame length N (power of 2)
 * @returns {Float64Array} magnitudes for bins 0..N/2
 */
export function magnitudeSpectrum(frame) {
  const n = frame.length;
  const re = Float64Array.from(frame);
  const im = new Float64Array(n);
  fft(re, im);
  const half = n / 2;
  const mag = new Float64Array(half + 1);
  for (let k = 0; k <= half; k++) mag[k] = Math.hypot(re[k], im[k]);
  return mag;
}
