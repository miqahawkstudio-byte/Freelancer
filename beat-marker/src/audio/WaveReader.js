/**
 * WaveReader.js — pure PCM WAV parser -> normalized mono float. No deps.
 *
 * Supports the WAV subset V1 needs: PCM (fmt 1) 16/24/32-bit int and IEEE float
 * (fmt 3) 32/64-bit, mono or stereo, any sample rate. Stereo is downmixed to
 * mono (average) for analysis. The original file is never modified — this reads
 * bytes into an in-memory Float32Array.
 *
 * MP3 is decoded by the native/WASM engine (dr_mp3); the pure-JS reference
 * engine here handles WAV so the whole pipeline is testable offline.
 */

import { BeatMarkerError, ErrorCode } from '../utils/Errors.js';

/**
 * @param {ArrayBuffer|Uint8Array} input
 * @returns {{ sampleRate:number, channels:number, samples:Float32Array,
 *            durationSeconds:number, bitDepth:number, format:'pcm'|'float' }}
 *          `samples` is mono, in [-1, 1].
 */
export function decodeWav(input) {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  if (buf.length < 12 || str(buf, 0, 4) !== 'RIFF' || str(buf, 8, 4) !== 'WAVE') {
    throw new BeatMarkerError(ErrorCode.DECODE_FAILED, 'Not a valid WAV file.');
  }

  let fmt = null;
  let dataOffset = -1;
  let dataLength = 0;

  // Walk chunks.
  let p = 12;
  while (p + 8 <= buf.length) {
    const id = str(buf, p, 4);
    const size = dv.getUint32(p + 4, true);
    const body = p + 8;
    if (id === 'fmt ') {
      fmt = {
        audioFormat: dv.getUint16(body, true),
        channels: dv.getUint16(body + 2, true),
        sampleRate: dv.getUint32(body + 4, true),
        bitsPerSample: dv.getUint16(body + 14, true),
      };
    } else if (id === 'data') {
      dataOffset = body;
      dataLength = Math.min(size, buf.length - body);
    }
    p = body + size + (size & 1); // chunks are word-aligned
  }

  if (!fmt) throw new BeatMarkerError(ErrorCode.DECODE_FAILED, 'WAV missing fmt chunk.');
  if (dataOffset < 0) throw new BeatMarkerError(ErrorCode.DECODE_FAILED, 'WAV missing data chunk.');

  const { audioFormat, channels, sampleRate, bitsPerSample } = fmt;
  const isFloat = audioFormat === 3;
  const isPcm = audioFormat === 1;
  if ((!isPcm && !isFloat) || channels < 1) {
    throw new BeatMarkerError(
      ErrorCode.UNSUPPORTED_FORMAT,
      `Unsupported WAV encoding (format ${audioFormat}, ${bitsPerSample}-bit).`
    );
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameBytes = bytesPerSample * channels;
  const frameCount = Math.floor(dataLength / frameBytes);
  const mono = new Float32Array(frameCount);

  const readOne = sampleReader(dv, isFloat, bitsPerSample);
  if (!readOne) {
    throw new BeatMarkerError(
      ErrorCode.UNSUPPORTED_FORMAT,
      `Unsupported WAV bit depth: ${bitsPerSample}-bit.`
    );
  }

  for (let i = 0; i < frameCount; i++) {
    const base = dataOffset + i * frameBytes;
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += readOne(base + c * bytesPerSample);
    mono[i] = sum / channels;
  }

  return {
    sampleRate,
    channels,
    samples: mono,
    durationSeconds: frameCount / sampleRate,
    bitDepth: bitsPerSample,
    format: isFloat ? 'float' : 'pcm',
  };
}

/** Return a function that reads one normalized sample at a byte offset. */
function sampleReader(dv, isFloat, bits) {
  if (isFloat && bits === 32) return (o) => dv.getFloat32(o, true);
  if (isFloat && bits === 64) return (o) => dv.getFloat64(o, true);
  if (!isFloat && bits === 16) return (o) => dv.getInt16(o, true) / 32768;
  if (!isFloat && bits === 32) return (o) => dv.getInt32(o, true) / 2147483648;
  if (!isFloat && bits === 24) {
    return (o) => {
      const b0 = dv.getUint8(o);
      const b1 = dv.getUint8(o + 1);
      const b2 = dv.getUint8(o + 2);
      let v = b0 | (b1 << 8) | (b2 << 16);
      if (v & 0x800000) v |= ~0xffffff; // sign-extend 24 -> 32
      return v / 8388608;
    };
  }
  return null;
}

function str(buf, off, len) {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(buf[off + i]);
  return s;
}
