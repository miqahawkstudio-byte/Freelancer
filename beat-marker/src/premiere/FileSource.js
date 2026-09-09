/**
 * FileSource.js — pick and read a WAV/MP3 file from disk via UXP storage.
 *
 * Uses the UXP local file system API (require('uxp').storage.localFileSystem).
 * Returns raw bytes; decoding is done by the engine (decodeAudio). MP3 decoding
 * needs the native/WASM engine, so a picked MP3 is passed through as bytes and
 * the engine reports a clear error until that backend is built.
 */

import { BeatMarkerError, ErrorCode } from '../utils/Errors.js';
import { hostRequire } from './hostRequire.js';
import { log } from '../utils/Logger.js';

function uxpFs() {
  const uxp = hostRequire('uxp');
  const fs = uxp?.storage?.localFileSystem;
  if (!fs) throw new BeatMarkerError(ErrorCode.UXP_UNAVAILABLE);
  return { fs, formats: uxp.storage.formats };
}

/**
 * Prompt the user to choose a WAV or MP3 file.
 * @returns {Promise<null | { name:string, ext:string, buffer:Uint8Array, sizeBytes:number }>}
 *          null if the user cancels the dialog.
 */
export async function pickAudioFile() {
  const { fs, formats } = uxpFs();
  // VERIFY-IN-PPRO: getFileForOpening options (types filter) across UXP versions.
  const entry = await fs.getFileForOpening({ types: ['wav', 'mp3'], allowMultiple: false });
  if (!entry) return null; // user cancelled

  const name = entry.name || 'audio';
  const ext = name.toLowerCase().split('.').pop();
  if (ext !== 'wav' && ext !== 'mp3') {
    throw new BeatMarkerError(ErrorCode.UNSUPPORTED_FORMAT);
  }

  const data = await entry.read({ format: formats.binary });
  const buffer = data instanceof Uint8Array ? data : new Uint8Array(data);
  log('file', 'pickAudioFile', { name, ext, sizeBytes: buffer.length });
  return { name, ext, buffer, sizeBytes: buffer.length };
}

/**
 * Prompt to save text (e.g. exported beat grid) to a file.
 * @param {string} text
 * @param {string} suggestedName e.g. "beatgrid.json"
 * @returns {Promise<boolean>} false if the user cancels
 */
export async function saveTextFile(text, suggestedName) {
  const { fs, formats } = uxpFs();
  // VERIFY-IN-PPRO: getFileForSaving options across UXP versions.
  const entry = await fs.getFileForSaving(suggestedName);
  if (!entry) return false; // cancelled
  await entry.write(text, { format: formats.utf8 });
  log('file', 'saveTextFile', { name: entry.name, bytes: text.length });
  return true;
}
