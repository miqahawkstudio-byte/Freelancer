/**
 * Tracks.js — read-only enumeration of audio tracks (Krok 1).
 *
 * Verified UXP surface: seq.getAudioTrackCount(), seq.getAudioTrack(i) ->
 * AudioTrack { name, id }.
 */

import { getActiveSequence } from './Sequence.js';
import { log } from '../utils/Logger.js';

/**
 * List audio tracks as { index, id, name, label } for the UI dropdown.
 * `label` is a friendly "A1", "A2", ... in timeline order.
 */
export async function listAudioTracks() {
  const seq = await getActiveSequence();
  const count = await seq.getAudioTrackCount();
  const tracks = [];
  for (let i = 0; i < count; i++) {
    const track = await seq.getAudioTrack(i);
    tracks.push({
      index: i,
      id: track.id, // VERIFY-IN-PPRO: property vs getId()
      name: track.name, // VERIFY-IN-PPRO: property vs getName()
      label: `A${i + 1}`,
    });
  }
  log('tracks', 'listAudioTracks', { count });
  return tracks;
}

/** Get the raw AudioTrack object for a given index. */
export async function getAudioTrack(index) {
  const seq = await getActiveSequence();
  return seq.getAudioTrack(index);
}
