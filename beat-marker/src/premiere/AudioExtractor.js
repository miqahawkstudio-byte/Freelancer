/**
 * AudioExtractor.js — render timeline audio to temporary WAV files for analysis.
 *
 * UXP exposes no raw PCM, so timeline audio must be rendered via the encoder
 * (app.encoder). Two modes:
 *   - 'perClip': render each clip's on-timeline segment separately
 *     (encodeProjectItem/encodeFile with in/out), so a specific track is
 *     analyzed and gaps are preserved. Beat times map back via clip.startSeconds.
 *   - 'mix': render the whole sequence (encodeSequence) — the full mix-down.
 *
 * Temp WAVs live in the plugin's data/temp folder with unique names and are
 * removed by cleanup() unless the user opts to keep them.
 *
 * VERIFY-IN-PPRO throughout: the exact encoder signatures, the PCM-WAV preset
 * (.epr) path, progress/cancel semantics, and ProjectItem media accessors must
 * be confirmed in a running Premiere 25.x. This module is written against the
 * documented surface; nothing here is invented API, but the encoder details are
 * the part most likely to need adjustment on first run.
 */

import { ppro } from './env.js';
import { listClips } from './Clips.js';
import { ticksToSeconds } from './Timecode.js';
import { BeatMarkerError, ErrorCode, toBeatMarkerError } from '../utils/Errors.js';
import { log } from '../utils/Logger.js';

const TEMP_DIRNAME = 'beat-marker-cache';

function uxp() {
  // eslint-disable-next-line no-undef
  return typeof require === 'function' ? require('uxp') : null;
}

/** Create/return the plugin temp folder for rendered audio. */
async function tempFolder() {
  const fs = uxp()?.storage?.localFileSystem;
  if (!fs) throw new BeatMarkerError(ErrorCode.UXP_UNAVAILABLE);
  const dataFolder = await fs.getDataFolder();
  // VERIFY-IN-PPRO: getEntry vs createEntry when folder already exists.
  try {
    return await dataFolder.getEntry(TEMP_DIRNAME);
  } catch {
    return await dataFolder.createFolder(TEMP_DIRNAME);
  }
}

function uniqueName(prefix) {
  const id = Math.random().toString(16).slice(2, 8);
  return `${prefix}_${Date.now().toString(16)}_${id}.wav`;
}

const _created = []; // temp entries to clean up

/**
 * Render timeline audio and return WAV buffers ready for analysis.
 *
 * @param {Object} opts
 * @param {'perClip'|'mix'} opts.mode
 * @param {number} opts.trackIndex          used in 'perClip'
 * @param {{ inTicks?:number, outTicks?:number }} [opts.range]  optional analysis range
 * @param {string} opts.presetPath          path to a PCM-WAV .epr preset
 * @param {(p:number)=>void} [opts.onProgress]
 * @param {() => boolean} [opts.isCancelled]
 * @returns {Promise<{ mode:string, clips?:Array<{startSeconds:number, buffer:Uint8Array}>, buffer?:Uint8Array }>}
 */
export async function renderTimelineAudio(opts) {
  const { mode, trackIndex, range, presetPath, onProgress, isCancelled } = opts;
  if (!presetPath) {
    throw new BeatMarkerError(
      ErrorCode.EXPORT_FAILED,
      'A PCM WAV export preset (.epr) is required to render timeline audio.'
    );
  }
  const api = ppro();
  const encoder = api.EncoderManager ? await api.EncoderManager.getManager() : api.app?.encoder;
  if (!encoder) throw new BeatMarkerError(ErrorCode.EXPORT_FAILED, 'Encoder is unavailable.');

  try {
    if (mode === 'mix') {
      const buffer = await renderSequenceMix(encoder, presetPath, range, onProgress, isCancelled);
      return { mode, buffer };
    }
    const clips = await listClips(trackIndex);
    const filtered = range ? clipsInRange(clips, range) : clips;
    if (filtered.length === 0) throw new BeatMarkerError(ErrorCode.NO_AUDIO_CLIPS);

    const out = [];
    for (let i = 0; i < filtered.length; i++) {
      if (isCancelled && isCancelled()) throw cancelled();
      const clip = filtered[i];
      const buffer = await renderClip(encoder, clip, presetPath);
      out.push({ startSeconds: clip.startSeconds, buffer });
      if (onProgress) onProgress((i + 1) / filtered.length);
    }
    return { mode, clips: out };
  } catch (e) {
    if (e && e.cancelled) throw e;
    throw toBeatMarkerError(e, ErrorCode.EXPORT_FAILED);
  }
}

// VERIFY-IN-PPRO: encodeProjectItem signature + how to bound to the clip's
// in/out; and how to read the resulting file bytes back.
async function renderClip(encoder, clip, presetPath) {
  const folder = await tempFolder();
  const file = await folder.createFile(uniqueName('clip'), { overwrite: true });
  _created.push(file);
  const projectItem = clip.projectItem || (clip.getProjectItem && (await clip.getProjectItem()));
  // encodeProjectItem(projectItem, outputPath, presetPath, workArea, removeUponCompletion)
  await encoder.encodeProjectItem(projectItem, file.nativePath, presetPath, /*workArea*/ 1, false);
  return readBytes(file);
}

// VERIFY-IN-PPRO: encodeSequence signature + work-area range for In/Out.
async function renderSequenceMix(encoder, presetPath, range, onProgress) {
  const api = ppro();
  const project = await api.Project.getActiveProject();
  const sequence = await project.getActiveSequence();
  const folder = await tempFolder();
  const file = await folder.createFile(uniqueName('mix'), { overwrite: true });
  _created.push(file);
  const workArea = range && range.inTicks != null ? 2 /* in/out */ : 0 /* entire */;
  await encoder.encodeSequence(sequence, file.nativePath, presetPath, workArea, false);
  if (onProgress) onProgress(1);
  return readBytes(file);
}

async function readBytes(fileEntry) {
  const formats = uxp().storage.formats;
  const data = await fileEntry.read({ format: formats.binary });
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

/** Remove all temp files created this session. */
export async function cleanup() {
  for (const entry of _created.splice(0)) {
    try {
      await entry.delete();
    } catch (e) {
      log('extractor', 'cleanup failed', { message: String(e) });
    }
  }
}

function clipsInRange(clips, range) {
  const inT = range.inTicks ?? -Infinity;
  const outT = range.outTicks ?? Infinity;
  return clips.filter((c) => c.endTicks > inT && c.startTicks < outT);
}

function cancelled() {
  const e = new Error('cancelled');
  e.cancelled = true;
  return e;
}

// Re-export for callers that only need seconds mapping.
export { ticksToSeconds };
