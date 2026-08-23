/**
 * panel.js — UI wiring for the Beat Marker panel.
 *
 * Sources:
 *   - Manual BPM  : builds a grid mathematically (no engine/audio needed).
 *   - Audio File  : pick WAV/MP3 -> decode -> analyze -> grid (works today for
 *                   WAV; MP3 waits on the native/WASM decoder).
 *   - Timeline    : render audio via the encoder (per-clip or whole mix) ->
 *                   assemble -> analyze -> grid. Encoder details are
 *                   VERIFY-IN-PPRO and require a PCM-WAV preset.
 *
 * CREATE MARKERS maps the current grid to exact timeline ticks and writes real
 * markers in one undoable transaction. Every host call is guarded by isUxp().
 */

import { isUxp } from '../premiere/env.js';
import { readSequenceInfo } from '../premiere/Sequence.js';
import { listAudioTracks } from '../premiere/Tracks.js';
import { createMarkers, deleteGeneratedMarkers } from '../premiere/Markers.js';
import { framesToTimecode, secondsToFrames, formatDuration } from '../premiere/Timecode.js';
import { buildGridFromBpm, beatsPerBar } from '../beatGrid/BeatGrid.js';
import { computePlacements } from '../beatGrid/placement.js';
import { analyzeWavBuffer, analyzeClipBuffers } from '../engine/timelineAnalyze.js';
import { pickAudioFile } from '../premiere/FileSource.js';
import { renderTimelineAudio, cleanup } from '../premiere/AudioExtractor.js';
import { toBeatMarkerError } from '../utils/Errors.js';

const $ = (id) => document.getElementById(id);

let seqInfo = null;
let currentGrid = null;
let rangeStartSeconds = 0;
let cancelFlag = false;

// TODO(config): path to a PCM-WAV .epr preset for timeline rendering. Until the
// user configures one (Settings), timeline Auto analysis reports it's needed.
let PCM_WAV_PRESET = null;

function status(msg, kind = '') {
  const bar = $('statusBar');
  bar.textContent = msg || '';
  bar.className = `statusbar ${kind}`;
}

function showProgress(on, label = 'Analyzing audio…') {
  $('progress').classList.toggle('hidden', !on);
  if (on) {
    $('progressLabel').textContent = label;
    setProgress(0);
  }
}
function setProgress(p) {
  $('progressFill').style.width = `${Math.round(p * 100)}%`;
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
    status(`Sequence: ${seqInfo.nominalFps} fps${seqInfo.dropFrame ? ' DF' : ''}, ${tracks.length} audio track(s).`, 'ok');
  } catch (e) {
    status(toBeatMarkerError(e).userMessage, 'error');
  }
}

function selectedMeter() {
  const m = $('meterSelect').value;
  return m === 'auto' ? '4/4' : m;
}

function analyzeOptions() {
  return {
    minBpm: 60,
    maxBpm: 200,
    sensitivity: Number($('sensitivity').value) / 100,
    meterHint: $('meterSelect').value,
    onProgress: (p) => setProgress(0.1 + 0.85 * p),
    isCancelled: () => cancelFlag,
  };
}

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
  if (seqInfo) {
    const abs = currentGrid.firstBeat + rangeStartSeconds;
    const frame = secondsToFrames(abs, seqInfo) + seqInfo.zeroPointTicks / seqInfo.ticksPerFrame;
    $('firstBeatTc').textContent = framesToTimecode(frame, seqInfo, seqInfo.dropFrame);
  }
}

/** ANALYZE / BUILD GRID dispatcher. */
async function onAnalyze() {
  const source = document.querySelector('input[name="source"]:checked').value;
  if ($('bpmMode').value === 'manual') return buildManualGrid();
  if (source === 'file') return status('Use "Choose File" to load and analyze an audio file.', '');
  return analyzeTimeline();
}

function buildManualGrid() {
  if (!seqInfo) return status('Open a sequence in Premiere Pro first.', 'error');
  const bpm = Number($('manualBpm').value);
  if (!(bpm > 0)) return status('Enter a valid Manual BPM.', 'error');
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

async function analyzeTimeline() {
  if (!isUxp()) return status('Open in Premiere Pro to analyze the timeline.', '');
  if (!seqInfo) return status('Open a sequence first.', 'error');
  if (!PCM_WAV_PRESET) {
    return status('Timeline analysis needs a PCM WAV export preset (.epr). Set one in Settings.', 'error');
  }
  const mode = $('extractMode').value === 'mix' ? 'mix' : 'perClip';
  cancelFlag = false;
  showProgress(true, mode === 'mix' ? 'Rendering sequence mix…' : 'Rendering track clips…');
  try {
    const rendered = await renderTimelineAudio({
      mode,
      trackIndex: Number($('trackSelect').value || 0),
      presetPath: PCM_WAV_PRESET,
      onProgress: (p) => setProgress(0.05 + 0.05 * p),
      isCancelled: () => cancelFlag,
    });
    const opts = analyzeOptions();
    if (rendered.mode === 'mix') {
      currentGrid = analyzeWavBuffer(rendered.buffer, opts).grid;
      rangeStartSeconds = 0;
    } else {
      const res = analyzeClipBuffers(rendered.clips, opts);
      currentGrid = res.grid;
      rangeStartSeconds = res.rangeStartSeconds;
    }
    renderResult();
    status(`Analyzed: ${currentGrid.bpm} BPM, ${currentGrid.beats.length} beats.`, 'ok');
  } catch (e) {
    if (e && e.cancelled) status('Analysis cancelled.', '');
    else status(toBeatMarkerError(e).userMessage, 'error');
  } finally {
    showProgress(false);
    if (!$('keepTemp')?.checked) await cleanup().catch(() => {});
  }
}

async function onChooseFile() {
  if (!isUxp()) return status('Open in Premiere Pro to choose a file.', '');
  cancelFlag = false;
  try {
    const picked = await pickAudioFile();
    if (!picked) return; // cancelled
    $('fileInfo').classList.remove('hidden');
    $('fileInfo').textContent = `File: ${picked.name} · ${(picked.sizeBytes / 1048576).toFixed(1)} MB`;
    if (picked.ext === 'mp3') {
      return status('MP3 decoding needs the native/WASM engine (not yet built). Use WAV for now.', 'error');
    }
    showProgress(true, 'Analyzing audio…');
    const { grid, durationSeconds } = analyzeWavBuffer(picked.buffer, analyzeOptions());
    currentGrid = grid;
    rangeStartSeconds = 0;
    $('fileInfo').textContent += ` · ${formatDuration(durationSeconds)}`;
    renderResult();
    status(`Analyzed ${picked.name}: ${grid.bpm} BPM.`, 'ok');
  } catch (e) {
    status(toBeatMarkerError(e).userMessage, 'error');
  } finally {
    showProgress(false);
  }
}

function offsetSeconds() {
  return Number($('offsetMs').value || 0) / 1000;
}

function onSetFirstBeat() {
  if (!currentGrid || !seqInfo) return status('Build or analyze a grid first.', '');
  renderResult();
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

function onCancel() {
  cancelFlag = true;
  status('Cancelling…', '');
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
  $('chooseFile').addEventListener('click', onChooseFile);
  $('cancelBtn').addEventListener('click', onCancel);

  toggleSource();
  toggleBpmMode();
  refreshTimeline();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wire);
} else {
  wire();
}
