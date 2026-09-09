/**
 * index.js — engine selection facade.
 *
 * One stable entry point, `analyzeAudio(audio, options)`, backed by a
 * selectable engine. All engines return the SAME BeatGrid shape, so choosing
 * between them (the Krok 4 benchmark decision) never ripples into the rest of
 * the app.
 *
 *   'js'     — pure-JS reference engine (default; always available; used by
 *              tests and the benchmark, and as the cross-platform fallback).
 *   'native' — aubio compiled as a UXP hybrid .uxpaddon (fastest; Windows x64
 *              first). Loaded lazily via UXP require(); not present here.
 *   'wasm'   — aubio compiled to WebAssembly (cross-platform single artifact).
 *
 * decodeAudio() picks WAV (pure JS) now; MP3 goes through the native/WASM
 * decoder (dr_mp3) once wired.
 */

import { analyzeAudioJs } from './analyze.js';
import { decodeWav } from '../audio/WaveReader.js';
import { BeatMarkerError, ErrorCode } from '../utils/Errors.js';

const ENGINES = {
  js: analyzeAudioJs,
  native: nativeNotAvailable,
  wasm: wasmNotAvailable,
};

let _preferred = 'js';

/** Choose the engine used by analyzeAudio(). Falls back to 'js' if unavailable. */
export function setPreferredEngine(name) {
  _preferred = ENGINES[name] ? name : 'js';
  return _preferred;
}

export function getPreferredEngine() {
  return _preferred;
}

/**
 * Analyze decoded audio -> BeatGrid. `engine` overrides the preferred engine.
 * @param {{ samples:Float32Array, sampleRate:number }} audio
 * @param {object} [options]  see analyze.js; plus optional { engine }
 */
export function analyzeAudio(audio, options = {}) {
  const name = options.engine || _preferred;
  const fn = ENGINES[name] || ENGINES.js;
  return fn(audio, options);
}

/**
 * Decode a file buffer to { samples, sampleRate } by extension/magic.
 * @param {ArrayBuffer|Uint8Array} buffer
 * @param {string} [nameOrExt] filename or extension hint
 */
export function decodeAudio(buffer, nameOrExt = '') {
  const ext = String(nameOrExt).toLowerCase().split('.').pop();
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  const isWav = ext === 'wav' || (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49); // "RI"
  if (isWav) {
    const { samples, sampleRate } = decodeWav(bytes);
    return { samples, sampleRate };
  }
  if (ext === 'mp3') {
    throw new BeatMarkerError(
      ErrorCode.ENGINE_MISSING,
      'MP3 decoding requires the native/WASM engine (dr_mp3), not yet built.'
    );
  }
  throw new BeatMarkerError(ErrorCode.UNSUPPORTED_FORMAT, 'Unsupported audio format. Use WAV or MP3.');
}

function nativeNotAvailable() {
  throw new BeatMarkerError(
    ErrorCode.ENGINE_MISSING,
    'Native engine (.uxpaddon) is not built in this environment.'
  );
}
function wasmNotAvailable() {
  throw new BeatMarkerError(ErrorCode.ENGINE_MISSING, 'WASM engine is not built in this environment.');
}
