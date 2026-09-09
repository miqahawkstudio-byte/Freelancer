/**
 * Markers.js — create and delete real Premiere markers (Krok 3 target).
 *
 * Verified UXP surface:
 *   Markers.getMarkers(sequenceOrProjectItem) -> Markers
 *   markers.createAddMarkerAction(name, type, startTime:TickTime, duration:TickTime, comments)
 *   markers.createRemoveMarkerAction(marker)
 *   markers.getMarkers(filters?)  -> Marker[]
 *   project.executeTransaction(cb, undoLabel)  (since 25.6)
 *   TickTime.createWithTicks(str) / createWithSeconds(n)
 *
 * Safety: we only ever delete markers whose comments carry our [BEAT-MARKER] tag.
 * All creates/deletes for one operation run inside a SINGLE executeTransaction so
 * the user gets one clean Undo.
 *
 * NOT YET WIRED to the UI — this is the adapter surface Krok 3 will call. Marker
 * color is intentionally omitted: the UXP marker API in the reference does not
 * expose a color setter (VERIFY-IN-PPRO). Type/label carry the distinction for
 * now; color is a V1.1 item pending confirmation.
 */

import { getActiveProject } from './env.js';
import { getActiveSequence } from './Sequence.js';
import { ppro } from './env.js';
import { buildComment, buildLabel, isOurs } from './markerTag.js';
import { BeatMarkerError, ErrorCode, toBeatMarkerError } from '../utils/Errors.js';
import { log } from '../utils/Logger.js';

// Marker type string. VERIFY-IN-PPRO: exact accepted value ("Comment").
const MARKER_TYPE_COMMENT = 'Comment';

/**
 * Create markers for a list of placements in one undoable transaction.
 *
 * @param {Array<{ beat:import('../beatGrid/BeatGrid.js').Beat, ticks:number }>} placements
 * @returns {Promise<number>} number of markers created
 */
export async function createMarkers(placements) {
  if (!placements || placements.length === 0) return 0;
  const project = await getActiveProject();
  const seq = await getActiveSequence();
  const api = ppro();
  const markers = api.Markers.getMarkers(seq);

  try {
    const ok = project.executeTransaction((compound) => {
      for (const { beat, ticks } of placements) {
        const start = api.TickTime.createWithTicks(String(ticks));
        const zeroDur = api.TickTime.createWithSeconds(0);
        const action = markers.createAddMarkerAction(
          buildLabel(beat),
          MARKER_TYPE_COMMENT,
          start,
          zeroDur,
          buildComment(beat)
        );
        compound.addAction(action); // VERIFY-IN-PPRO: CompoundAction.addAction name
      }
    }, 'Beat Marker: create markers');
    if (!ok) throw new BeatMarkerError(ErrorCode.MARKER_FAILED);
    log('markers', 'createMarkers', { count: placements.length });
    return placements.length;
  } catch (e) {
    throw toBeatMarkerError(e, ErrorCode.MARKER_FAILED);
  }
}

/**
 * Delete ONLY markers created by Beat Marker (identified by the [BEAT-MARKER]
 * tag in their comments). User markers are never touched.
 *
 * @returns {Promise<number>} number of markers removed
 */
export async function deleteGeneratedMarkers() {
  const project = await getActiveProject();
  const seq = await getActiveSequence();
  const api = ppro();
  const markers = api.Markers.getMarkers(seq);

  const all = await markers.getMarkers();
  const ours = [];
  for (const m of all) {
    const comments = await readComments(m);
    if (isOurs(comments)) ours.push(m);
  }
  if (ours.length === 0) return 0;

  try {
    const ok = project.executeTransaction((compound) => {
      for (const m of ours) {
        compound.addAction(markers.createRemoveMarkerAction(m));
      }
    }, 'Beat Marker: delete generated markers');
    if (!ok) throw new BeatMarkerError(ErrorCode.MARKER_FAILED);
    log('markers', 'deleteGeneratedMarkers', { removed: ours.length });
    return ours.length;
  } catch (e) {
    throw toBeatMarkerError(e, ErrorCode.MARKER_FAILED);
  }
}

/** Read a marker's comments string across possible property/getter shapes. */
async function readComments(marker) {
  // VERIFY-IN-PPRO: `comments` property vs getComments().
  if (typeof marker.comments === 'string') return marker.comments;
  if (typeof marker.getComments === 'function') return marker.getComments();
  return '';
}
