/**
 * timelineAssemble.js — pure assembly of a track's clips into one analysis
 * buffer, preserving timeline positions and GAPS. No host/UI dependency.
 *
 * A single audio track can hold several clips with silence between them. We
 * render/decode each clip's on-timeline segment, then lay them back down at
 * their timeline offsets on a common sample rate. Gaps stay silent, so the DSP
 * engine finds no onsets there and never emits phantom beats in a gap. Analyzing
 * the whole track in one pass (rather than per clip) also keeps one consistent
 * tempo when a single song is split across clips.
 *
 * Output beat times are relative to `rangeStartSeconds` (the earliest clip on
 * the timeline within the analyzed range); the Premiere layer adds the sequence
 * offset when placing markers (see beatGrid/placement.js `rangeStartSeconds`).
 */

/**
 * @param {Array<{ startSeconds:number, samples:Float32Array, sampleRate:number }>} clips
 * @param {{ targetRate?:number }} [opts]
 * @returns {{ samples:Float32Array, sampleRate:number, rangeStartSeconds:number,
 *            spanSeconds:number, gaps:Array<[number,number]> }}
 *          `gaps` are [startRel, endRel] silent spans (seconds, range-relative).
 */
export function assembleTrackAudio(clips, opts = {}) {
  if (!clips || clips.length === 0) {
    return { samples: new Float32Array(0), sampleRate: opts.targetRate || 48000, rangeStartSeconds: 0, spanSeconds: 0, gaps: [] };
  }

  const targetRate = opts.targetRate || clips[0].sampleRate || 48000;

  // Normalize each clip to the target rate and compute its timeline extent.
  const norm = clips
    .map((c) => {
      const samples = c.sampleRate === targetRate ? c.samples : resampleLinear(c.samples, c.sampleRate, targetRate);
      return { startSeconds: c.startSeconds, samples, durationSeconds: samples.length / targetRate };
    })
    .sort((a, b) => a.startSeconds - b.startSeconds);

  const rangeStart = norm[0].startSeconds;
  const rangeEnd = Math.max(...norm.map((c) => c.startSeconds + c.durationSeconds));
  const spanSeconds = rangeEnd - rangeStart;
  const total = Math.max(0, Math.round(spanSeconds * targetRate));
  const out = new Float32Array(total);

  // Track covered regions to derive gaps.
  const covered = [];
  for (const c of norm) {
    const offset = Math.round((c.startSeconds - rangeStart) * targetRate);
    for (let i = 0; i < c.samples.length && offset + i < total; i++) {
      out[offset + i] += c.samples[i]; // clips shouldn't overlap on one track; add is safe
    }
    covered.push([c.startSeconds - rangeStart, c.startSeconds - rangeStart + c.durationSeconds]);
  }

  return { samples: out, sampleRate: targetRate, rangeStartSeconds: rangeStart, spanSeconds, gaps: gapsFromCovered(covered, spanSeconds) };
}

/** Linear-interpolation resampler. Adequate for onset/tempo analysis. */
export function resampleLinear(samples, srcRate, dstRate) {
  if (srcRate === dstRate) return samples;
  const ratio = dstRate / srcRate;
  const outLen = Math.max(0, Math.round(samples.length * ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i / ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(samples.length - 1, i0 + 1);
    const frac = srcPos - i0;
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  return out;
}

/** Merge covered spans and return the complementary gaps within [0, span]. */
function gapsFromCovered(covered, span) {
  if (covered.length === 0) return [];
  const sorted = [...covered].sort((a, b) => a[0] - b[0]);
  const merged = [sorted[0].slice()];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i][0] <= last[1] + 1e-9) last[1] = Math.max(last[1], sorted[i][1]);
    else merged.push(sorted[i].slice());
  }
  const gaps = [];
  let cursor = 0;
  for (const [s, e] of merged) {
    if (s - cursor > 1e-6) gaps.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (span - cursor > 1e-6) gaps.push([cursor, span]);
  return gaps;
}
