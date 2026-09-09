import { test, eq, assert } from './harness.mjs';
import { decodeWav } from '../src/audio/WaveReader.js';
import { estimateMeter, estimateMeterFromAccents } from '../src/engine/dsp.js';

test('decodeWav throws a typed error for a non-WAV buffer', () => {
  let err = null;
  try {
    decodeWav(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
  } catch (e) {
    err = e;
  }
  assert(err, 'should throw');
  assert(/WAV/i.test(err.userMessage || err.message), `friendly message, got: ${err.message}`);
});

test('decodeWav rejects an unsupported encoding cleanly', () => {
  // Valid RIFF/WAVE header but an absurd format code + odd bit depth.
  const buf = new Uint8Array(64);
  const dv = new DataView(buf.buffer);
  const put = (o, s) => s.split('').forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  put(0, 'RIFF');
  dv.setUint32(4, 56, true);
  put(8, 'WAVE');
  put(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 99, true); // bogus format
  dv.setUint16(22, 1, true);
  dv.setUint32(24, 44100, true);
  dv.setUint16(34, 7, true); // odd bit depth
  put(36, 'data');
  dv.setUint32(40, 0, true);
  let err = null;
  try {
    decodeWav(buf);
  } catch (e) {
    err = e;
  }
  assert(err && (err.code === 'UNSUPPORTED_FORMAT' || /Unsupported/i.test(err.message)), 'unsupported format error');
});

test('estimateMeter detects 3/4 from an accent-every-3 pattern', () => {
  // Build an onset envelope where bar-starts (every 3rd beat) are strong.
  const env = new Float64Array(600);
  const beatFrames = [];
  for (let k = 0; k < 12; k++) {
    const f = k * 40;
    beatFrames.push(f);
    env[f] = k % 3 === 0 ? 1.0 : 0.4;
  }
  const m = estimateMeter(env, beatFrames);
  eq(m.bpb, 3);
  eq(m.downbeatOffset, 0);
});

test('estimateMeter detects 4/4 from an accent-every-4 pattern', () => {
  const env = new Float64Array(800);
  const beatFrames = [];
  for (let k = 0; k < 16; k++) {
    const f = k * 40;
    beatFrames.push(f);
    env[f] = k % 4 === 0 ? 1.0 : 0.4;
  }
  const m = estimateMeter(env, beatFrames);
  eq(m.bpb, 4);
});

test('estimateMeterFromAccents uses grid positions, so a gap does not shift downbeats', () => {
  // Beats present at grid indices 0,1,2,3, then 6,7,8,9 (indices 4,5 fell in a
  // gap). Accents are on true downbeats gi%4===0 -> gi 0 and 8.
  const positions = [0, 1, 2, 3, 6, 7, 8, 9];
  const strengths = positions.map((gi) => (gi % 4 === 0 ? 1.0 : 0.4));
  const m = estimateMeterFromAccents(positions, strengths, [4, 3]);
  eq(m.bpb, 4);
  eq(m.downbeatOffset, 0); // grid-based: correct. Array-index-based would mis-pick.
});
