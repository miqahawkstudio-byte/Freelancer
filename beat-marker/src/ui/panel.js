/**
 * panel.js — UI wiring for the Beat Marker panel.
 *
 * Krok 0/1 scope: render the panel, toggle source/BPM sections, and — when
 * running inside Premiere — populate the sequence/track dropdowns from the live
 * read-only adapters. Analysis (engine) and marker creation from a grid arrive
 * in later steps and are stubbed with honest "next step" status here. Delete
 * Generated Markers is already wired to the real, safe adapter.
 *
 * The panel must not crash outside Premiere (dev preview), so every host call is
 * guarded by isUxp().
 */

import { isUxp } from '../premiere/env.js';
import { readSequenceInfo } from '../premiere/Sequence.js';
import { listAudioTracks } from '../premiere/Tracks.js';
import { deleteGeneratedMarkers } from '../premiere/Markers.js';
import { framesToTimecode, secondsToFrames } from '../premiere/Timecode.js';
import { toBeatMarkerError } from '../utils/Errors.js';

const $ = (id) => document.getElementById(id);

/** Current known sequence info, refreshed on load. */
let seqInfo = null;

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
}

async function refreshTimeline() {
  if (!isUxp()) {
    status('Preview mode — open in Premiere Pro to read the timeline.', '');
    return;
  }
  try {
    seqInfo = await readSequenceInfo();
    const seqSel = $('sequenceSelect');
    seqSel.innerHTML = `<option>${seqInfo.name ?? 'Active Sequence'}</option>`;

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
    const err = toBeatMarkerError(e);
    status(err.userMessage, 'error');
  }
}

function onAnalyze() {
  // Engine wiring lands in Krok 4/6. Keep the UI honest until then.
  status('Analysis engine is not wired yet (next implementation step).', '');
}

function onCreateMarkers() {
  status('Run Analyze first — marker creation from a beat grid comes next step.', '');
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

function onSetFirstBeat() {
  // Placeholder preview of the offset math (no grid yet).
  const offsetMs = Number($('offsetMs').value || 0);
  if (!seqInfo) return status('Detected first beat appears here after Analyze.', '');
  const seconds = offsetMs / 1000;
  const frame = secondsToFrames(seconds, seqInfo);
  $('firstBeatTc').textContent = framesToTimecode(frame, seqInfo, seqInfo.dropFrame);
}

function wire() {
  document.querySelectorAll('input[name="source"]').forEach((r) =>
    r.addEventListener('change', toggleSource)
  );
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
