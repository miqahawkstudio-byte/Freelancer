/**
 * Sequence.js — read-only view of the active sequence (Krok 1).
 *
 * Wraps the documented UXP Sequence methods and returns plain data the UI and
 * timecode layer can use. All methods are async (UXP is Promise-based).
 *
 * Verified UXP surface (developer.adobe.com/premiere-pro/uxp):
 *   project.getActiveSequence(), seq.getTimebase(), seq.getZeroPoint(),
 *   seq.getInPoint(), seq.getOutPoint(), seq.getEndTime(),
 *   seq.getAudioTrackCount(), seq.getAudioTrack(i)
 */

import { getActiveProject } from './env.js';
import { rateFromTimebase, ticksToSeconds } from './Timecode.js';
import { BeatMarkerError, ErrorCode } from '../utils/Errors.js';
import { log } from '../utils/Logger.js';

/** Get the raw active Sequence object (UXP), or throw a friendly error. */
export async function getActiveSequence() {
  const project = await getActiveProject();
  const seq = await project.getActiveSequence();
  if (!seq) throw new BeatMarkerError(ErrorCode.NO_ACTIVE_SEQUENCE);
  return seq;
}

/**
 * Read a normalized description of the active sequence: rate, zero point,
 * in/out, end — everything the timecode math and range selection need.
 *
 * @returns {Promise<{
 *   name?:string, ticksPerFrame:number, fps:number, nominalFps:number,
 *   dropFrame:boolean, zeroPointTicks:number, inTicks:number, outTicks:number,
 *   endTicks:number, durationSeconds:number
 * }>}
 */
export async function readSequenceInfo() {
  const seq = await getActiveSequence();

  const timebase = await seq.getTimebase(); // ticks-per-frame (string/number)
  const rate = rateFromTimebase(timebase);

  const zeroPoint = await seq.getZeroPoint();
  const inPt = await seq.getInPoint();
  const outPt = await seq.getOutPoint();
  const endPt = await seq.getEndTime();

  const zeroPointTicks = tickNum(zeroPoint);
  const inTicks = tickNum(inPt);
  const outTicks = tickNum(outPt);
  const endTicks = tickNum(endPt);

  const info = {
    name: seq.name, // VERIFY-IN-PPRO: property vs getName()
    ticksPerFrame: rate.ticksPerFrame,
    fps: rate.fps,
    nominalFps: rate.nominalFps,
    // VERIFY-IN-PPRO: drop-frame flag source (sequence settings). Default false
    // until confirmed; DF affects display only, never marker placement.
    dropFrame: false,
    zeroPointTicks,
    inTicks,
    outTicks,
    endTicks,
    durationSeconds: ticksToSeconds(endTicks - zeroPointTicks),
  };
  log('sequence', 'readSequenceInfo', info);
  return info;
}

/** Extract a numeric tick value from a TickTime (or a raw number). */
function tickNum(t) {
  if (t == null) return 0;
  if (typeof t === 'number') return t;
  // TickTime exposes ticksNumber (number) and ticks (string).
  if (typeof t.ticksNumber === 'number') return t.ticksNumber;
  if (t.ticks != null) return Number(t.ticks);
  return 0;
}
