import { test, eq, assert } from './harness.mjs';
import { buildGridFromBpm } from '../src/beatGrid/BeatGrid.js';
import { gridToJSON, gridToCSV } from '../src/beatGrid/exportGrid.js';
import { resolveRate } from '../src/premiere/Timecode.js';

const grid = buildGridFromBpm({ bpm: 120, firstBeat: 0, durationSeconds: 4, meter: '4/4' });

const rate = resolveRate({ fps: 25 });
const seqInfo = {
  ticksPerFrame: rate.ticksPerFrame,
  fps: rate.fps,
  nominalFps: rate.nominalFps,
  dropFrame: false,
  zeroPointTicks: 25 * 3600 * rate.ticksPerFrame, // 01:00:00:00
};

test('gridToJSON round-trips and carries key fields', () => {
  const json = gridToJSON(grid);
  const parsed = JSON.parse(json);
  eq(parsed.bpm, 120);
  eq(parsed.meter, '4/4');
  eq(parsed.beatCount, grid.beats.length);
  eq(parsed.beats.length, grid.beats.length);
});

test('gridToJSON adds timeline timecode when seqInfo given (non-zero start)', () => {
  const parsed = JSON.parse(gridToJSON(grid, { seqInfo }));
  eq(parsed.beats[0].timelineTimecode, '01:00:00:00'); // first beat at zero point
  eq(parsed.beats[2].timelineTimecode, '01:00:01:00'); // 3rd beat = +1s at 120bpm
});

test('gridToCSV has a header and one row per beat', () => {
  const csv = gridToCSV(grid);
  const lines = csv.trim().split('\n');
  eq(lines[0], 'index,bar,beatInBar,type,timeSeconds,strength');
  eq(lines.length, grid.beats.length + 1);
});

test('gridToCSV appends timelineTimecode column with seqInfo', () => {
  const csv = gridToCSV(grid, { seqInfo });
  const lines = csv.trim().split('\n');
  assert(lines[0].endsWith(',timelineTimecode'), 'header has timecode column');
  assert(lines[1].endsWith('01:00:00:00'), `first row timecode: ${lines[1]}`);
});

test('rangeStartSeconds offsets the exported timecodes', () => {
  const parsed = JSON.parse(gridToJSON(grid, { seqInfo, rangeStartSeconds: 5 }));
  eq(parsed.beats[0].timelineTimecode, '01:00:05:00');
});
