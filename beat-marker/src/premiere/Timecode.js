/**
 * Timecode.js — pure timecode / tick math. NO Premiere/UXP dependency.
 *
 * This module is deliberately UI- and host-independent so it can be unit-tested
 * in plain Node and reused by both the UXP panel and the (future) engine glue.
 *
 * Adobe represents time internally in "ticks". There are exactly
 * 254016000000 ticks per second. That constant is highly divisible, so for all
 * common frame rates the number of ticks-per-frame is an integer — which is why
 * we can place markers on exact frame boundaries with no floating-point drift.
 *
 * In real Premiere, `Sequence.getTimebase()` already returns ticks-per-frame,
 * and `TickTime.createWithFrameAndFrameRate()` / `alignToFrame()` do the final
 * placement. This module mirrors that math so results are verifiable offline and
 * so mapping (seconds -> frame -> ticks -> timecode) is centralized in one place.
 *
 * Drop-frame (DF) is ONLY a display convention for 29.97 / 59.94. It does not
 * change a frame's tick position — it changes how the timecode string reads.
 * So DF affects formatting for the UI only, never marker placement.
 */

export const TICKS_PER_SECOND = 254016000000;

/**
 * Known exact ticks-per-frame for common rates. Values are integers because
 * TICKS_PER_SECOND is divisible by each rate's exact fraction.
 *   23.976 = 24000/1001, 29.97 = 30000/1001, 59.94 = 60000/1001
 */
export const TICKS_PER_FRAME = Object.freeze({
  24: 10584000000,
  25: 10160640000,
  30: 8467200000,
  50: 5080320000,
  60: 4233600000,
  // 1001-based rates (NTSC family)
  '23.976': 10594584000, // TICKS_PER_SECOND * 1001 / 24000
  '29.97': 8475667200, //   TICKS_PER_SECOND * 1001 / 30000
  '59.94': 4237833600, //   TICKS_PER_SECOND * 1001 / 60000
});

/** seconds -> ticks (exact integer ticks). */
export function secondsToTicks(seconds) {
  return Math.round(seconds * TICKS_PER_SECOND);
}

/** ticks -> seconds. */
export function ticksToSeconds(ticks) {
  return Number(ticks) / TICKS_PER_SECOND;
}

/**
 * Derive frame-rate info from the sequence timebase (ticks-per-frame).
 * This is the authoritative path when running inside Premiere: we take the
 * number Premiere gives us instead of guessing the rate.
 *
 * @param {number|string} ticksPerFrame
 * @returns {{ ticksPerFrame:number, fps:number, nominalFps:number }}
 */
export function rateFromTimebase(ticksPerFrame) {
  const tpf = Number(ticksPerFrame);
  if (!Number.isFinite(tpf) || tpf <= 0) {
    throw new RangeError(`Invalid timebase (ticksPerFrame): ${ticksPerFrame}`);
  }
  const fps = TICKS_PER_SECOND / tpf;
  return { ticksPerFrame: tpf, fps, nominalFps: Math.round(fps) };
}

/**
 * Resolve a rate from either a plain fps number (24, 25, 29.97, 30, ...) or a
 * ticks-per-frame value, into the fields the rest of the module needs.
 *
 * @param {{ fps?:number, ticksPerFrame?:number }} opts
 */
export function resolveRate({ fps, ticksPerFrame } = {}) {
  if (ticksPerFrame != null) return rateFromTimebase(ticksPerFrame);
  if (fps == null) throw new RangeError('resolveRate requires fps or ticksPerFrame');

  // Match a known table entry first (keeps ticks exact); else derive generically.
  const key = String(fps);
  let tpf = TICKS_PER_FRAME[key] ?? TICKS_PER_FRAME[Number(fps)];
  if (tpf == null) tpf = Math.round(TICKS_PER_SECOND / fps);
  return { ticksPerFrame: tpf, fps: TICKS_PER_SECOND / tpf, nominalFps: Math.round(fps) };
}

/** seconds -> nearest whole frame index at the given rate. */
export function secondsToFrames(seconds, rate) {
  const { fps } = normalizeRate(rate);
  return Math.round(seconds * fps);
}

/** frame index -> ticks (exact). */
export function framesToTicks(frame, rate) {
  const { ticksPerFrame } = normalizeRate(rate);
  return Math.round(frame) * ticksPerFrame;
}

/** frame index -> seconds. */
export function framesToSeconds(frame, rate) {
  const { fps } = normalizeRate(rate);
  return Math.round(frame) / fps;
}

/**
 * Map an ABSOLUTE timeline time (seconds) to the ticks a marker must sit on,
 * accounting for the sequence zero point. This is the core placement function:
 * it snaps to the nearest frame first (marker must land on a frame boundary).
 *
 * @param {number} absSeconds        absolute time on the sequence, in seconds
 * @param {number} zeroPointTicks    sequence zero point, in ticks (from getZeroPoint)
 * @param {object} rate              fps or ticksPerFrame descriptor
 * @returns {number} ticks
 */
export function timelineTicksForSeconds(absSeconds, zeroPointTicks, rate) {
  const r = normalizeRate(rate);
  const frame = Math.round(absSeconds * r.fps);
  return zeroPointTicks + frame * r.ticksPerFrame;
}

/**
 * Format a frame index as a timecode string.
 * DF uses ';' before frames, NDF uses ':'.
 */
export function framesToTimecode(frame, rate, dropFrame = false) {
  const { fps, nominalFps } = normalizeRate(rate);
  let f = Math.round(frame);
  if (f < 0) f = 0;

  if (dropFrame && isDropCapable(fps)) {
    return formatDropFrame(f, fps, nominalFps);
  }
  const fr = nominalFps;
  const frames = f % fr;
  const seconds = Math.floor(f / fr) % 60;
  const minutes = Math.floor(f / (fr * 60)) % 60;
  const hours = Math.floor(f / (fr * 3600)) % 24;
  return `${p(hours)}:${p(minutes)}:${p(seconds)}:${p(frames)}`;
}

/**
 * Parse a timecode string back to a frame index. Accepts ':' or ';' separators;
 * the dropFrame flag decides how the count is reconstructed.
 */
export function timecodeToFrames(tc, rate, dropFrame = false) {
  const { fps, nominalFps } = normalizeRate(rate);
  const parts = String(tc).split(/[:;]/).map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    throw new RangeError(`Invalid timecode: ${tc}`);
  }
  const [hh, mm, ss, ff] = parts;
  const fr = nominalFps;

  if (dropFrame && isDropCapable(fps)) {
    const dropFrames = Math.round(fps * 0.066666); // 2 for 29.97, 4 for 59.94
    const totalMinutes = 60 * hh + mm;
    return (
      fr * 3600 * hh +
      fr * 60 * mm +
      fr * ss +
      ff -
      dropFrames * (totalMinutes - Math.floor(totalMinutes / 10))
    );
  }
  return fr * 3600 * hh + fr * 60 * mm + fr * ss + ff;
}

/** Human duration mm:ss (or h:mm:ss) for the UI header. */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return hh > 0 ? `${hh}:${p(mm)}:${p(ss)}` : `${p(mm)}:${p(ss)}`;
}

// ---- internals -------------------------------------------------------------

function normalizeRate(rate) {
  if (rate == null) throw new RangeError('rate is required');
  if (typeof rate === 'number') return resolveRate({ fps: rate });
  if (rate.fps != null || rate.ticksPerFrame != null) {
    // Already-resolved descriptors carry nominalFps; pass through if complete.
    if (rate.nominalFps != null && rate.ticksPerFrame != null) return rate;
    return resolveRate(rate);
  }
  throw new RangeError('Unrecognized rate descriptor');
}

function isDropCapable(fps) {
  // DF only exists for the 29.97 and 59.94 NTSC rates.
  return Math.abs(fps - 29.97) < 0.02 || Math.abs(fps - 59.94) < 0.02;
}

function formatDropFrame(frameNumber, fps, nominalFps) {
  const dropFrames = Math.round(fps * 0.066666); // 2 or 4
  const framesPer10Min = Math.round(fps * 600);
  const framesPerMin = nominalFps * 60 - dropFrames;
  const framesPer24h = Math.round(fps * 3600) * 24;

  let f = frameNumber % framesPer24h;
  const d = Math.floor(f / framesPer10Min);
  const m = f % framesPer10Min;
  if (m > dropFrames) {
    f += dropFrames * 9 * d + dropFrames * Math.floor((m - dropFrames) / framesPerMin);
  } else {
    f += dropFrames * 9 * d;
  }
  const fr = nominalFps;
  const frames = f % fr;
  const seconds = Math.floor(f / fr) % 60;
  const minutes = Math.floor(f / (fr * 60)) % 60;
  const hours = Math.floor(f / (fr * 3600)) % 24;
  return `${p(hours)}:${p(minutes)}:${p(seconds)};${p(frames)}`;
}

function p(n) {
  return String(n).padStart(2, '0');
}
