/**
 * panel.js — UI wiring for the Beat Marker panel.
 *
 * Krok 3 scope: a complete, working vertical slice that does NOT need the DSP
 * engine yet — Manual BPM builds a real BeatGrid mathematically, and CREATE
 * MARKERS maps it to exact timeline ticks and writes real Premiere markers in a
 * single undoable transaction. Auto (analysis) BPM stays an honest stub until
 * the engine lands (Krok 4/5). Delete Generated Markers removes only our tagged
 * markers.
 *
 * Every host call is guarded by isUxp() so the panel previews safely outside
 * Premiere.
 */

import { isUxp } from '../premiere/env.js';
import { readSequenceInfo } from '../premiere/Sequence.js';
import { listAudioTracks } from '../premiere/Tracks.js';
import { createMarkers, deleteGeneratedMarkers } from '../premiere/Markers.js';
import { framesToTimecode, secondsToFrames, formatDuration } from '../premiere/Timecode.js';
import { buildGridFromBpm, beatsPerBar } from '../beatGrid/BeatGrid.js';
import { computePlacements } from '../beatGrid/placement.js';
import { toBeatMarkerError } from '../utils/Errors.js';

const $ = (id) => document.getElementById(id);

/** Panel state. */
let seqInfo = null; // last-read sequence descriptor
let currentGrid = null; // last-built/analyzed BeatGrid
let rangeStartSeconds = 0; // where the grid's t=0 sits on the timeline

function status(msg, kind = '') {
  const bar = $('statusBar');
  bar.textContent = msg || '';
  bar.className = `statusbar ${kind}`;
}

function toggleSource() {
  const isFile = document.querySelector('input[name="source"]:checked').value === 'file';
  $('fileSource').classList.toggle('hidden', !isFile);
  $('timelineSource').classList.toggle('hidden', isFile);
}

function toggleBpmMode() {
  const manual = $('bpmMode').value === 'manual';
  $('manualBpm').classList.toggle('hidden', !manual);
  $('analyzeBtn').textContent = manual ? 'BUILD GRID' : 'ANALYZE';
}

async function refreshTimeline() {
  if (!isUxp()) {
    status('Preview mode — open in Premiere Pro to read the timeline.', '');
    return;
  }
  try {
    seqInfo = await readSequenceInfo();
    $('sequenceSelect').innerHTML = `<option>${seqInfo.name ?? 'Active Sequence'}</option>`;

    const tracks = await listAudioTracks();
    const trackSel = $('trackSelect');
    trackSel.disabled = false;
    trackSel.innerHTML = tracks
      .map((t) => `<option value="${t.index}">${t.label}${t.name ? ` — ${t.name}` : ''}</option>`)
      .join('');

    status(
      `Sequence: ${seqInfo.nominalFps} fps${seqInfo.dropFrame ? ' DF' : ''}, ` +
        `${tracks.length} audio track(s).`,
      'ok'
    );
  } catch (e) {
    status(toBeatMarkerError(e).userMessage, 'error');
  }
}

/** Resolve the meter to use (Auto -> 4/4 for the manual math). */
function selectedMeter() {
  const m = $('meterSelect').value;
  return m === 'auto' ? '4/4' : m;
}

/** Render the RESULT + FIRST BEAT sections from currentGrid. */
function renderResult() {
  if (!currentGrid) return;
  const meter = currentGrid.meter;
  const bars = Math.max(1, Math.ceil(currentGrid.beats.length / beatsPerBar(meter)));
  $('result').classList.remove('hidden');
  $('rBpm').textContent = String(currentGrid.bpm);
  $('rMeter').textContent = meter;
  $('rConf').textContent = `${Math.round(currentGrid.confidence * 100)}%`;
  $('rDur').textContent = seqInfo ? formatDuration(seqInfo.durationSeconds) : '—';
  $('rBeats').textContent = String(currentGrid.beats.length);
  $('rBars').textContent = String(bars);

  // First beat timecode (absolute on the timeline).
  if (seqInfo) {
    const abs = currentGrid.firstBeat + rangeStartSeconds;
    const frame = secondsToFrames(abs, seqInfo) + seqInfo.zeroPointTicks / seqInfo.ticksPerFrame;
    $('firstBeatTc').textContent = framesToTimecode(frame, seqInfo, seqInfo.dropFrame);
  }
}

/**
 * ANALYZE / BUILD GRID. In Manual mode we build the grid from BPM now (no engine
 * needed). In Auto mode the DSP engine is not wired yet — say so honestly.
 */
function onAnalyze() {
  if ($('bpmMode').value !== 'manual') {
    status('Auto analysis engine is not wired yet — use Manual BPM for now.', '');
    return;
  }
  if (!seqInfo) {
    status('Open a sequence in Premiere Pro first.', 'error');
    return;
  }
  const bpm = Number($('manualBpm').value);
  if (!(bpm > 0)) {
    status('Enter a valid Manual BPM.', 'error');
    return;
  }
  currentGrid = buildGridFromBpm({
    bpm,
    firstBeat: 0,
    durationSeconds: seqInfo.durationSeconds,
    meter: selectedMeter(),
    confidence: 1,
  });
  rangeStartSeconds = 0;
  renderResult();
  status(`Built ${currentGrid.beats.length} beats at ${bpm} BPM.`, 'ok');
}

/** Offset in seconds from the First Beat Offset field. */
function offsetSeconds() {
  return Number($('offsetMs').value || 0) / 1000;
}

function onSetFirstBeat() {
  if (!currentGrid || !seqInfo) {
    status('Build a grid first (Manual BPM).', '');
    return;
  }
  renderResult(); // refresh detected TC display; offset is applied at create time
  const off = offsetSeconds();
  status(off ? `First beat offset: ${off * 1000} ms.` : 'First beat offset cleared.', '');
}

async function onCreateMarkers() {
  if (!isUxp()) return status('Open in Premiere Pro to create markers.', '');
  if (!currentGrid || !seqInfo) return status('Build or analyze a grid first.', 'error');
  try {
    const placements = computePlacements(currentGrid, $('markerMode').value, seqInfo, {
      rangeStartSeconds,
      extraOffsetSeconds: offsetSeconds(),
    });
    if (placements.length === 0) return status('No markers to create for this mode/range.', '');
    const n = await createMarkers(placements);
    status(`Created ${n} marker(s).`, 'ok');
  } catch (e) {
    status(toBeatMarkerError(e).userMessage, 'error');
  }
}

async function onDeleteMarkers() {
  if (!isUxp()) return status('Open in Premiere Pro to manage markers.', '');
  try {
    const n = await deleteGeneratedMarkers();
    status(n > 0 ? `Deleted ${n} Beat Marker marker(s).` : 'No Beat Marker markers found.', 'ok');
  } catch (e) {
    status(toBeatMarkerError(e).userMessage, 'error');
  }
}

function wire() {
  document
    .querySelectorAll('input[name="source"]')
    .forEach((r) => r.addEventListener('change', toggleSource));
  $('bpmMode').addEventListener('change', toggleBpmMode);
  $('analyzeBtn').addEventListener('click', onAnalyze);
  $('createMarkers').addEventListener('click', onCreateMarkers);
  $('deleteMarkers').addEventListener('click', onDeleteMarkers);
  $('setFirstBeat').addEventListener('click', onSetFirstBeat);
  $('chooseFile').addEventListener('click', () =>
    status('File picker wiring comes with the decoder step.', '')
  );

  toggleSource();
  toggleBpmMode();
  refreshTimeline();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wire);
} else {
  wire();
}
