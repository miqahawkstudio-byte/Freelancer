/**
 * Clips.js — read-only enumeration of audio clips on a track (Krok 1).
 *
 * A single track may hold many clips with gaps between them. We must respect
 * each clip's timeline position and its source in/out, and NOT treat gaps as
 * audio. This module returns a normalized, gap-aware list; the analysis layer
 * (Krok 5) renders/decodes per clip and maps beat times back with:
 *   timelineSeconds = clip.startSeconds + (beatSeconds - clip.inSeconds)
 *
 * Verified UXP surface: audioTrack.getTrackItems(type, includeEmpty) ->
 * AudioClipTrackItem[]; item.getStartTime/getEndTime/getInPoint/getOutPoint()
 * -> TickTime; item.getProjectItem() -> ProjectItem.
 */

import { getAudioTrack } from './Tracks.js';
import { ppro } from './env.js';
import { ticksToSeconds } from './Timecode.js';
import { BeatMarkerError, ErrorCode } from '../utils/Errors.js';
import { log } from '../utils/Logger.js';

/**
 * List audio clips on a track as normalized descriptors.
 *
 * @param {number} trackIndex
 * @returns {Promise<Array<{
 *   startTicks:number, endTicks:number, inTicks:number, outTicks:number,
 *   startSeconds:number, endSeconds:number, inSeconds:number, outSeconds:number,
 *   durationSeconds:number, name?:string, mediaPath?:string
 * }>>}
 */
export async function listClips(trackIndex) {
  const track = await getAudioTrack(trackIndex);
  const api = ppro();

  // VERIFY-IN-PPRO: exact enum path for the "clip" track-item type.
  const clipType = api?.Constants?.TrackItemType?.CLIP;
  const items = await track.getTrackItems(clipType, false);

  const clips = [];
  for (const item of items) {
    const start = tickNum(await item.getStartTime());
    const end = tickNum(await item.getEndTime());
    const inPt = tickNum(await item.getInPoint());
    const outPt = tickNum(await item.getOutPoint());

    let name;
    let mediaPath;
    try {
      const projectItem = await item.getProjectItem();
      name = projectItem?.name; // VERIFY-IN-PPRO
      // VERIFY-IN-PPRO: media path accessor on ProjectItem (e.g. getMediaFilePath()).
      if (typeof projectItem?.getMediaFilePath === 'function') {
        mediaPath = await projectItem.getMediaFilePath();
      }
    } catch (e) {
      log('clips', 'projectItem read failed', { message: String(e) });
    }

    clips.push({
      startTicks: start,
      endTicks: end,
      inTicks: inPt,
      outTicks: outPt,
      startSeconds: ticksToSeconds(start),
      endSeconds: ticksToSeconds(end),
      inSeconds: ticksToSeconds(inPt),
      outSeconds: ticksToSeconds(outPt),
      durationSeconds: ticksToSeconds(end - start),
      name,
      mediaPath,
    });
  }

  clips.sort((a, b) => a.startTicks - b.startTicks);
  if (clips.length === 0) throw new BeatMarkerError(ErrorCode.NO_AUDIO_CLIPS);
  log('clips', 'listClips', { trackIndex, count: clips.length });
  return clips;
}

/**
 * Filter clips to those overlapping a [inTicks, outTicks] range and clamp each
 * clip's effective span to the range. Used for the "In/Out" analysis scope so we
 * only analyze the selected portion. Returns clips with `analyzeStartTicks` /
 * `analyzeEndTicks` set to the clamped span.
 */
export function clampClipsToRange(clips, rangeInTicks, rangeOutTicks) {
  const out = [];
  for (const c of clips) {
    const s = Math.max(c.startTicks, rangeInTicks);
    const e = Math.min(c.endTicks, rangeOutTicks);
    if (e <= s) continue; // no overlap
    out.push({ ...c, analyzeStartTicks: s, analyzeEndTicks: e });
  }
  return out;
}

function tickNum(t) {
  if (t == null) return 0;
  if (typeof t === 'number') return t;
  if (typeof t.ticksNumber === 'number') return t.ticksNumber;
  if (t.ticks != null) return Number(t.ticks);
  return 0;
}
