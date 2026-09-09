import { test, eq, near } from './harness.mjs';
import {
  TICKS_PER_SECOND,
  rateFromTimebase,
  resolveRate,
  secondsToFrames,
  framesToTicks,
  timelineTicksForSeconds,
  framesToTimecode,
  timecodeToFrames,
  formatDuration,
  ticksToSeconds,
} from '../src/premiere/Timecode.js';

test('timebase 8467200000 -> 30 fps', () => {
  const r = rateFromTimebase(8467200000);
  eq(r.nominalFps, 30);
  near(r.fps, 30, 1e-6);
});

test('timebase 8475667200 -> 29.97 fps', () => {
  const r = rateFromTimebase(8475667200);
  eq(r.nominalFps, 30);
  near(r.fps, 29.97, 0.001);
});

test('ticks-per-frame is exact integer for 29.97', () => {
  // TICKS_PER_SECOND * 1001 / 30000 must be integer -> no drift.
  eq((TICKS_PER_SECOND * 1001) % 30000, 0);
  eq(resolveRate({ fps: 29.97 }).ticksPerFrame, 8475667200);
});

test('secondsToFrames rounds to nearest frame @25fps', () => {
  eq(secondsToFrames(1.0, { fps: 25 }), 25);
  eq(secondsToFrames(1.02, { fps: 25 }), 26); // 25.5 -> 26
});

test('framesToTicks exact @24fps', () => {
  eq(framesToTicks(1, { fps: 24 }), 10584000000);
  eq(framesToTicks(24, { fps: 24 }), TICKS_PER_SECOND); // 1 second
});

test('marker placement respects non-zero sequence start (01:00:00:00 @25)', () => {
  const rate = resolveRate({ fps: 25 });
  // Zero point at 1 hour: 25 * 3600 frames.
  const zeroTicks = 25 * 3600 * rate.ticksPerFrame;
  // First beat at 3.12s absolute -> nearest frame is 78 (3.12*25=78).
  const ticks = timelineTicksForSeconds(3.12, zeroTicks, rate);
  const absSeconds = ticksToSeconds(ticks);
  near(absSeconds, 3600 + 3.12, 0.0005);
  // And the frame index within the sequence is 78 past the hour.
  eq((ticks - zeroTicks) / rate.ticksPerFrame, 78);
});

test('NDF timecode format @30fps', () => {
  eq(framesToTimecode(0, { fps: 30 }, false), '00:00:00:00');
  eq(framesToTimecode(30, { fps: 30 }, false), '00:00:01:00');
  eq(framesToTimecode(3612, { fps: 30 }, false), '00:02:00:12');
});

test('DF timecode drops frame NUMBERS at minute boundaries @29.97', () => {
  // The first minute has 1800 frame labels (00:00:00;00 .. 00:00:59;29).
  eq(framesToTimecode(1799, { fps: 29.97 }, true), '00:00:59;29');
  // At the minute boundary DF skips labels ;00 and ;01, so frame 1800 is ;02.
  eq(framesToTimecode(1800, { fps: 29.97 }, true), '00:01:00;02');
  // The 10th minute is NOT dropped: frame 17982 lands exactly on 00:10:00;00.
  eq(framesToTimecode(17982, { fps: 29.97 }, true), '00:10:00;00');
});

test('timecode round-trips NDF and DF', () => {
  const ndf = framesToTimecode(5000, { fps: 30 }, false);
  eq(timecodeToFrames(ndf, { fps: 30 }, false), 5000);
  const df = framesToTimecode(5000, { fps: 29.97 }, true);
  eq(timecodeToFrames(df, { fps: 29.97 }, true), 5000);
});

test('formatDuration mm:ss and h:mm:ss', () => {
  eq(formatDuration(222), '03:42');
  eq(formatDuration(3723), '1:02:03');
});
