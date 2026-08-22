/**
 * bpm.js — pure BPM helpers: harmonic (octave) correction and range utilities.
 *
 * A very common detector failure is the "octave error": reporting 64 BPM for a
 * 128 BPM track, or 174 for 87, etc. We never assume a genre; instead we score
 * candidate tempi {x/2, x, 2x, ...} against a plausibility model and, when a
 * ground-truth onset envelope is available, against how well each candidate's
 * beat period aligns with detected onsets.
 */

/** Default musical plausibility window. Not genre-specific — just sane bounds. */
export const DEFAULT_MIN_BPM = 40;
export const DEFAULT_MAX_BPM = 220;

/**
 * Fold a raw BPM into the plausibility window by doubling/halving, returning all
 * candidates that fall inside [min,max]. e.g. 64 with default window -> [64, 128].
 */
export function harmonicCandidates(bpm, min = DEFAULT_MIN_BPM, max = DEFAULT_MAX_BPM) {
  if (!(bpm > 0)) throw new RangeError(`bpm must be > 0, got ${bpm}`);
  const set = new Set();

  // Walk down then up by factors of two, plus 3/2 and 2/3 for triplet-feel errors.
  const factors = [0.25, 1 / 3, 0.5, 2 / 3, 1, 1.5, 2, 3, 4];
  for (const f of factors) {
    const c = bpm * f;
    if (c >= min && c <= max) set.add(round2(c));
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * Pick the most likely BPM among harmonic candidates.
 *
 * If `onsets` (array of onset times in seconds) is provided, we score each
 * candidate by how consistently its beat period divides the inter-onset
 * structure (comb-style agreement). Without onsets we fall back to a soft
 * preference toward the center of the musical range (~120 BPM), which is a
 * weak prior only used to break ties.
 *
 * @param {number} rawBpm
 * @param {Object} [opts]
 * @param {number[]} [opts.onsets]      onset times (seconds), optional
 * @param {number}   [opts.min]
 * @param {number}   [opts.max]
 * @param {number}   [opts.preferred]   center of soft prior (default 120)
 * @returns {{ bpm:number, candidates:number[], scores:Record<string,number> }}
 */
export function correctOctave(rawBpm, opts = {}) {
  const { onsets, min = DEFAULT_MIN_BPM, max = DEFAULT_MAX_BPM, preferred = 120 } = opts;
  const candidates = harmonicCandidates(rawBpm, min, max);
  if (candidates.length === 0) return { bpm: round2(rawBpm), candidates: [rawBpm], scores: {} };

  const hasOnsets = Array.isArray(onsets) && onsets.length > 2;
  const scores = {};
  for (const c of candidates) {
    const prior = softPrior(c, preferred);
    // Coverage (precision/recall) is the discriminator: a too-fast candidate
    // leaves empty grid beats (low recall); a too-slow one leaves onsets between
    // beats (low precision). This separates 64 vs 128 vs 174 where phase-only
    // agreement cannot. Prior only nudges genuine ties.
    const fit = hasOnsets ? gridCoverage(onsets, c).f : 0;
    scores[c] = fit * 1.0 + prior * 0.15;
  }
  let best = candidates[0];
  for (const c of candidates) if (scores[c] > scores[best]) best = c;
  return { bpm: best, candidates, scores };
}

/**
 * Comb-filter agreement: for a candidate BPM, measure how well onsets fall on a
 * grid of period = 60/bpm. Returns 0..1 (higher = better fit). Phase-invariant:
 * we test the grid against the fractional position of each onset within a beat.
 */
export function combAgreement(onsets, bpm) {
  const period = 60 / bpm;
  if (!(period > 0)) return 0;

  // Histogram of onset phases within one beat period; a good tempo concentrates
  // energy near a single phase (onsets landing on beats), giving high focus.
  const bins = 16;
  const hist = new Array(bins).fill(0);
  for (const t of onsets) {
    const phase = ((t % period) + period) % period; // 0..period
    const b = Math.min(bins - 1, Math.floor((phase / period) * bins));
    hist[b] += 1;
  }
  const total = onsets.length || 1;
  // Peakiness = max bin share minus uniform baseline, normalized to 0..1.
  const peak = Math.max(...hist) / total;
  const baseline = 1 / bins;
  return Math.max(0, (peak - baseline) / (1 - baseline));
}

/**
 * Grid coverage precision/recall for a candidate BPM against detected onsets.
 * Phase is anchored to the first onset (treated as a beat). Returns
 * { precision, recall, f } in 0..1, where:
 *   precision = fraction of onsets that land on a grid beat (within tolerance)
 *   recall    = fraction of grid beats that are occupied by an onset
 *   f         = harmonic mean (0 when either is 0)
 *
 * This is the term that prevents spurious tempo doubling: doubling the tempo
 * halves recall (every other beat is empty), so the honest tempo scores higher.
 */
export function gridCoverage(onsets, bpm) {
  const period = 60 / bpm;
  if (!(period > 0) || onsets.length < 2) return { precision: 0, recall: 0, f: 0 };

  const sorted = [...onsets].sort((a, b) => a - b);
  const origin = sorted[0];
  const end = sorted[sorted.length - 1];
  const tol = 0.15 * period;

  // Precision: onsets close to their nearest grid beat.
  let onGrid = 0;
  for (const t of sorted) {
    const k = Math.round((t - origin) / period);
    if (Math.abs(t - (origin + k * period)) <= tol) onGrid += 1;
  }
  const precision = onGrid / sorted.length;

  // Recall: grid beats that have an onset nearby.
  const beatCount = Math.floor((end - origin) / period) + 1;
  let occupied = 0;
  let oi = 0;
  for (let k = 0; k < beatCount; k++) {
    const beatT = origin + k * period;
    // advance onset pointer to the neighborhood of this beat
    while (oi < sorted.length && sorted[oi] < beatT - tol) oi += 1;
    if (oi < sorted.length && Math.abs(sorted[oi] - beatT) <= tol) occupied += 1;
  }
  const recall = beatCount > 0 ? occupied / beatCount : 0;

  const f = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f };
}

function softPrior(bpm, preferred) {
  // Gaussian-ish bump centered on `preferred`; ~1 at center, decays outward.
  const sigma = 40;
  const d = (bpm - preferred) / sigma;
  return Math.exp(-0.5 * d * d);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
