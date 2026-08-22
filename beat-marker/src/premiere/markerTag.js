/**
 * markerTag.js — pure helpers for tagging and identifying Beat Marker markers.
 *
 * Premiere's UXP marker API does not expose a custom app-private id we can rely
 * on, but markers DO carry a `name` and `comments` string that we control at
 * creation time. So we stamp every marker we create with a machine-readable tag
 * inside its comments. Deletion then removes ONLY markers whose comments carry
 * this tag — the user's own markers are never touched.
 *
 * Comment format (single line, easy to grep, human-readable):
 *   [BEAT-MARKER] v=1 type=downbeat bar=1 beat=1 idx=1
 */

export const TAG = '[BEAT-MARKER]';
export const TAG_VERSION = 1;

/** Build the comments string stamped on a created marker. */
export function buildComment(beat) {
  return (
    `${TAG} v=${TAG_VERSION} ` +
    `type=${beat.type} bar=${beat.bar} beat=${beat.beatInBar} idx=${beat.index}`
  );
}

/**
 * Build the visible marker name/label. Downbeats read as bars, others as beats.
 * Format kept short so it's legible on the timeline ruler.
 */
export function buildLabel(beat) {
  if (beat.type === 'downbeat') return `BAR ${beat.bar}`;
  const tag = beat.type === 'strong' ? 'STRONG' : 'BEAT';
  return `${tag} ${beat.index}`;
}

/** True if a marker's comments string was created by Beat Marker. */
export function isOurs(comments) {
  return typeof comments === 'string' && comments.includes(TAG);
}

/** Parse our metadata back out of a comments string (or null if not ours). */
export function parseComment(comments) {
  if (!isOurs(comments)) return null;
  const out = {};
  for (const m of comments.matchAll(/(\w+)=([^\s]+)/g)) {
    out[m[1]] = /^\d+$/.test(m[2]) ? Number(m[2]) : m[2];
  }
  return out;
}
