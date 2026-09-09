/**
 * Test signal helpers (not a *.test.mjs, so the runner ignores it).
 * Synthesizes click tracks and encodes 16-bit PCM WAV for decoder tests.
 */

/**
 * Percussive click track at an exact BPM.
 * @param {Object} o
 * @param {number} o.bpm
 * @param {number} [o.seconds=8]
 * @param {number} [o.sampleRate=44100]
 * @param {number} [o.offset=0]        first beat time (seconds)
 * @param {number} [o.accentEvery=0]   if >0, make every Nth click louder (downbeat)
 * @returns {{ samples:Float32Array, sampleRate:number }}
 */
export function clickTrack({ bpm, seconds = 8, sampleRate = 44100, offset = 0, accentEvery = 0 }) {
  const n = Math.floor(seconds * sampleRate);
  const x = new Float32Array(n);
  const period = 60 / bpm;
  const clickLen = Math.floor(0.025 * sampleRate);
  const freq = 1500;

  let beat = 0;
  for (let t = offset; t < seconds; t += period, beat++) {
    const start = Math.floor(t * sampleRate);
    const accent = accentEvery > 0 && beat % accentEvery === 0 ? 1.0 : 0.55;
    for (let i = 0; i < clickLen && start + i < n; i++) {
      const env = Math.exp(-i / (clickLen * 0.3));
      x[start + i] += accent * env * Math.sin((2 * Math.PI * freq * i) / sampleRate);
    }
  }
  // Guard against clipping from overlaps.
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(x[i]));
  if (peak > 1) for (let i = 0; i < n; i++) x[i] /= peak;
  return { samples: x, sampleRate };
}

/**
 * Concatenate amplitude sections of deterministic white noise. Useful for
 * energy/section tests. amp is the peak amplitude of each segment (0 = silence).
 * @param {{ sampleRate?:number, parts:Array<{seconds:number, amp:number}>, seed?:number }} o
 * @returns {{ samples:Float32Array, sampleRate:number }}
 */
export function segments({ sampleRate = 44100, parts, seed = 12345 }) {
  const total = parts.reduce((n, p) => n + Math.floor(p.seconds * sampleRate), 0);
  const x = new Float32Array(total);
  let s = seed >>> 0;
  const rand = () => {
    // LCG -> [-1, 1)
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 0xffffffff) * 2 - 1;
  };
  let o = 0;
  for (const p of parts) {
    const len = Math.floor(p.seconds * sampleRate);
    for (let i = 0; i < len; i++) x[o++] = rand() * p.amp;
  }
  return { samples: x, sampleRate };
}

/** Encode mono Float32 samples as a 16-bit PCM WAV (Uint8Array). */
export function encodeWav16(samples, sampleRate) {
  const dataLen = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const dv = new DataView(buf);
  writeStr(dv, 0, 'RIFF');
  dv.setUint32(4, 36 + dataLen, true);
  writeStr(dv, 8, 'WAVE');
  writeStr(dv, 12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  writeStr(dv, 36, 'data');
  dv.setUint32(40, dataLen, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    dv.setInt16(o, Math.round(s * 32767), true);
    o += 2;
  }
  return new Uint8Array(buf);
}

function writeStr(dv, off, s) {
  for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
}
