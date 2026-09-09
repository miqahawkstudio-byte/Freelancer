/**
 * benchmark.mjs — Krok 4 engine benchmark: speed + BPM accuracy.
 *
 * Runs the same click-track corpus through a chosen engine and reports, per
 * tempo, the detected BPM, absolute error, and analysis time; then an aggregate
 * (mean abs error, mean realtime factor). This is the tool for the
 * native-vs-WASM decision: build those backends, then run
 *   node bench/benchmark.mjs --engine=native
 *   node bench/benchmark.mjs --engine=wasm
 * and compare against the JS baseline below.
 *
 * Usage: node bench/benchmark.mjs [--engine=js|native|wasm] [--seconds=30]
 */
import { analyzeAudio, setPreferredEngine } from '../src/engine/index.js';
import { clickTrack } from '../test/_signal.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const engine = args.engine || 'js';
const seconds = Number(args.seconds || 30);
const tempos = [90, 100, 110, 120, 128, 140, 160, 174];

setPreferredEngine(engine);
console.log(`\nBeat Marker engine benchmark — engine=${engine}, ${seconds}s signals\n`);
console.log('  BPM   detected   err     time      xRealtime');
console.log('  ----  ---------  ------  --------  ---------');

let totalErr = 0;
let totalRt = 0;
let ran = 0;

for (const bpm of tempos) {
  const audio = clickTrack({ bpm, seconds });
  try {
    // Warm one pass, then time one.
    analyzeAudio(audio, { minBpm: 60, maxBpm: 200 });
    const t0 = performance.now();
    const grid = analyzeAudio(audio, { minBpm: 60, maxBpm: 200 });
    const ms = performance.now() - t0;
    const err = Math.abs(grid.bpm - bpm);
    const xrt = (seconds * 1000) / ms;
    totalErr += err;
    totalRt += xrt;
    ran++;
    console.log(
      `  ${pad(bpm, 4)}  ${pad(grid.bpm.toFixed(1), 9)}  ${pad(err.toFixed(2), 6)}  ` +
        `${pad(ms.toFixed(1) + 'ms', 8)}  ${xrt.toFixed(0)}x`
    );
  } catch (e) {
    console.log(`  ${pad(bpm, 4)}  engine unavailable: ${e.userMessage || e.message}`);
  }
}

if (ran) {
  console.log('\n  Aggregate:');
  console.log(`    mean abs BPM error : ${(totalErr / ran).toFixed(2)}`);
  console.log(`    mean speed         : ${(totalRt / ran).toFixed(0)}x realtime\n`);
}

function pad(v, n) {
  return String(v).padStart(n);
}
