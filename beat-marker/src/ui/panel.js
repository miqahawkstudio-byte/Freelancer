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
import { decodeWav } from '../audio/WaveReader.js';
import { computePeaks } from '../audio/waveformPeaks.js';
import { assembleTrackAudio } from '../engine/timelineAssemble.js';
import { pickAudioFile, saveTextFile } from '../premiere/FileSource.js';
import { gridToJSON, gridToCSV } from '../beatGrid/exportGrid.js';
import { renderTimelineAudio, cleanup } from '../premiere/AudioExtractor.js';
import { SettingsStore, memoryBackend } from '../settings/SettingsStore.js';
import { Analyzer } from '../analysis/Analyzer.js';
import { setDevMode } from '../utils/Logger.js';
import { toBeatMarkerError } from '../utils/Errors.js';

const $ = (id) => document.getElementById(id);

let seqInfo = null;
let currentGrid = null;
let rangeStartSeconds = 0;
let cancelFlag = false;
let lastSamples = null; // analyzed audio for the waveform (null for manual grids)
let lastSampleRate = 0;

const settings = new SettingsStore(localStorageBackend());
const analyzer = new Analyzer();

/** localStorage-backed settings when available; in-memory otherwise. */
function localStorageBackend() {
  try {
    // eslint-disable-next-line no-undef
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* not available */
  }
  return memoryBackend();
}

/** Preset path comes from settings. */
function presetPath() {
  return settings.get('pcmWavPreset') || '';
}

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
    // Include the First Beat Offset so the displayed timecode matches where the
    // first marker actually lands (CREATE MARKERS applies the same offset).
    const abs = currentGrid.firstBeat + rangeStartSeconds + offsetSeconds();
    const frame = secondsToFrames(abs, seqInfo) + seqInfo.zeroPointTicks / seqInfo.ticksPerFrame;
    $('firstBeatTc').textContent = framesToTimecode(frame, seqInfo, seqInfo.dropFrame);
  }
}

// ---- settings --------------------------------------------------------------

function initSettings() {
  settings.load();
  analyzer.enabled = settings.get('cacheEnabled');
  setDevMode(settings.get('devMode'));
  applySettingsToUI();
}

function applySettingsToUI() {
  $('sensitivity').value = String(settings.get('sensitivity'));
  $('markerMode').value = settings.get('defaultMarkerMode');
  $('meterSelect').value = settings.get('defaultMeter');
  $('offsetMs').value = String(settings.get('firstBeatOffsetMs'));
  $('presetPath').value = settings.get('pcmWavPreset');
  $('cacheEnabled').checked = settings.get('cacheEnabled');
  $('keepTemp').checked = settings.get('keepTemp');
  $('devMode').checked = settings.get('devMode');
  const bpm = settings.get('defaultBpm');
  if (bpm !== 'auto') {
    $('bpmMode').value = 'manual';
    $('manualBpm').value = String(bpm);
    toggleBpmMode();
  }
}

/** Persist the current control values as the user's defaults. */
function saveSettingsFromUI() {
  settings.set({
    sensitivity: Number($('sensitivity').value),
    defaultMarkerMode: $('markerMode').value,
    defaultMeter: $('meterSelect').value,
    firstBeatOffsetMs: Number($('offsetMs').value || 0),
    pcmWavPreset: $('presetPath').value.trim(),
    cacheEnabled: $('cacheEnabled').checked,
    keepTemp: $('keepTemp').checked,
    devMode: $('devMode').checked,
  });
  analyzer.enabled = settings.get('cacheEnabled');
  setDevMode(settings.get('devMode'));
}

// ---- waveform --------------------------------------------------------------

function setWaveform(samples, sampleRate) {
  lastSamples = samples;
  lastSampleRate = sampleRate;
  drawWaveform();
}

function hideWaveform() {
  lastSamples = null;
  $('waveformSection').classList.add('hidden');
}

function drawWaveform() {
  const cv = $('waveform');
  if (!cv || !lastSamples || lastSamples.length === 0) return hideWaveform();
  $('waveformSection').classList.remove('hidden');

  const w = Math.max(1, cv.clientWidth || 300);
  const h = 80;
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);
  const mid = h / 2;
  const { mins, maxs } = computePeaks(lastSamples, w);
  ctx.strokeStyle = '#6f6f78';
  ctx.beginPath();
  for (let x = 0; x < w; x++) {
    ctx.moveTo(x + 0.5, mid - maxs[x] * mid);
    ctx.lineTo(x + 0.5, mid - mins[x] * mid);
  }
  ctx.stroke();

  const dur = lastSamples.length / lastSampleRate;
  if (currentGrid && dur > 0) {
    for (const b of currentGrid.beats) {
      const x = Math.round((b.time / dur) * w);
      if (x < 0 || x > w) continue;
      ctx.strokeStyle = b.type === 'downbeat' ? '#e0533d' : b.type === 'strong' ? '#e6c84a' : '#46c26a';
      ctx.globalAlpha = b.type === 'beat' ? 0.5 : 0.9;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
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
  hideWaveform(); // manual grid has no audio to show
  renderResult();
  status(`Built ${currentGrid.beats.length} beats at ${bpm} BPM.`, 'ok');
}

async function analyzeTimeline() {
  if (!isUxp()) return status('Open in Premiere Pro to analyze the timeline.', '');
  if (!seqInfo) return status('Open a sequence first.', 'error');
  if (!presetPath()) {
    return status('Timeline analysis needs a PCM WAV export preset (.epr). Set one in Settings.', 'error');
  }
  const mode = $('extractMode').value === 'mix' ? 'mix' : 'perClip';
  cancelFlag = false;
  showProgress(true, mode === 'mix' ? 'Rendering sequence mix…' : 'Rendering track clips…');
  try {
    const rendered = await renderTimelineAudio({
      mode,
      trackIndex: Number($('trackSelect').value || 0),
      presetPath: presetPath(),
      onProgress: (p) => setProgress(0.05 + 0.05 * p),
      isCancelled: () => cancelFlag,
    });
    const opts = analyzeOptions();
    let audio;
    if (rendered.mode === 'mix') {
      audio = decodeWav(rendered.buffer);
      rangeStartSeconds = 0;
    } else {
      const decoded = rendered.clips.map((c) => {
        const w = decodeWav(c.buffer);
        return { startSeconds: c.startSeconds, samples: w.samples, sampleRate: w.sampleRate };
      });
      const asm = assembleTrackAudio(decoded);
      audio = { samples: asm.samples, sampleRate: asm.sampleRate };
      rangeStartSeconds = asm.rangeStartSeconds;
    }
    const { grid, cached } = analyzer.analyze(audio, opts);
    currentGrid = grid;
    setWaveform(audio.samples, audio.sampleRate);
    renderResult();
    status(`Analyzed: ${grid.bpm} BPM, ${grid.beats.length} beats${cached ? ' (cached)' : ''}.`, 'ok');
  } catch (e) {
    if (e && e.cancelled) status('Analysis cancelled.', '');
    else status(toBeatMarkerError(e).userMessage, 'error');
  } finally {
    showProgress(false);
    if (!settings.get('keepTemp')) await cleanup().catch(() => {});
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
    const w = decodeWav(picked.buffer);
    const { grid, cached } = analyzer.analyze({ samples: w.samples, sampleRate: w.sampleRate, durationSeconds: w.durationSeconds }, analyzeOptions());
    currentGrid = grid;
    rangeStartSeconds = 0;
    setWaveform(w.samples, w.sampleRate);
    $('fileInfo').textContent += ` · ${formatDuration(w.durationSeconds)}`;
    renderResult();
    status(`Analyzed ${picked.name}: ${grid.bpm} BPM${cached ? ' (cached)' : ''}.`, 'ok');
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

/** Beat types allowed by the MARKERS checkboxes (composed with the Create mode). */
function allowedMarkerTypes() {
  const set = new Set();
  if ($('mAll').checked) set.add('beat');
  if ($('mStrong').checked) set.add('strong');
  if ($('mDown').checked) set.add('downbeat');
  return set;
}

async function onCreateMarkers() {
  if (!isUxp()) return status('Open in Premiere Pro to create markers.', '');
  if (!currentGrid || !seqInfo) return status('Build or analyze a grid first.', 'error');
  const allowed = allowedMarkerTypes();
  if (allowed.size === 0) return status('Select at least one beat type (All / Strong / Downbeats).', '');
  try {
    const placements = computePlacements(currentGrid, $('markerMode').value, seqInfo, {
      rangeStartSeconds,
      extraOffsetSeconds: offsetSeconds(),
    }).filter((p) => allowed.has(p.beat.type));
    if (placements.length === 0) return status('No markers to create for this mode/type/range.', '');
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

async function onExportGrid() {
  if (!currentGrid) return status('Build or analyze a grid first.', 'error');
  const format = $('exportFormat').value;
  const opts = { seqInfo, rangeStartSeconds, extraOffsetSeconds: offsetSeconds() };
  const text = format === 'csv' ? gridToCSV(currentGrid, opts) : gridToJSON(currentGrid, opts);
  if (!isUxp()) return status('Open in Premiere Pro to save the export.', '');
  try {
    const saved = await saveTextFile(text, `beatgrid.${format}`);
    status(saved ? `Beat grid exported (${format.toUpperCase()}).` : 'Export cancelled.', saved ? 'ok' : '');
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
  $('chooseFile').addEventListener('click', onChooseFile);
  $('cancelBtn').addEventListener('click', onCancel);
  $('exportGrid').addEventListener('click', onExportGrid);

  // Settings: persist on change and apply side effects.
  ['sensitivity', 'markerMode', 'meterSelect', 'offsetMs', 'presetPath', 'cacheEnabled', 'keepTemp', 'devMode'].forEach(
    (id) => $(id).addEventListener('change', saveSettingsFromUI)
  );
  $('clearCache').addEventListener('click', () => {
    analyzer.clear();
    status('Analysis cache cleared.', 'ok');
  });

  window.addEventListener('resize', () => {
    if (lastSamples) drawWaveform();
  });

  initSettings();
  toggleSource();
  toggleBpmMode();
  refreshTimeline();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wire);
} else {
  wire();
}
