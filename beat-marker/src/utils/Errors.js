/**
 * Errors.js — typed errors with short, user-facing messages.
 *
 * The UI shows `error.userMessage` (never a stack trace). `code` lets callers
 * branch, and `details` carries developer context for the log.
 */

export const ErrorCode = Object.freeze({
  UXP_UNAVAILABLE: 'UXP_UNAVAILABLE',
  NO_PROJECT: 'NO_PROJECT',
  NO_ACTIVE_SEQUENCE: 'NO_ACTIVE_SEQUENCE',
  NO_AUDIO_TRACK: 'NO_AUDIO_TRACK',
  NO_AUDIO_CLIPS: 'NO_AUDIO_CLIPS',
  EMPTY_RANGE: 'EMPTY_RANGE',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  DECODE_FAILED: 'DECODE_FAILED',
  EXPORT_FAILED: 'EXPORT_FAILED',
  NO_DISK_SPACE: 'NO_DISK_SPACE',
  ENGINE_FAILED: 'ENGINE_FAILED',
  ENGINE_MISSING: 'ENGINE_MISSING',
  MARKER_FAILED: 'MARKER_FAILED',
  CANCELLED: 'CANCELLED',
  UXP_ERROR: 'UXP_ERROR',
});

/** Short default copy per code; callers may override with a more specific one. */
const DEFAULT_MESSAGE = {
  [ErrorCode.UXP_UNAVAILABLE]: 'Premiere Pro is required to run Beat Marker.',
  [ErrorCode.NO_PROJECT]: 'Open a project first.',
  [ErrorCode.NO_ACTIVE_SEQUENCE]: 'Open a sequence first.',
  [ErrorCode.NO_AUDIO_TRACK]: 'The sequence has no audio track.',
  [ErrorCode.NO_AUDIO_CLIPS]: 'The selected track has no audio clips.',
  [ErrorCode.EMPTY_RANGE]: 'The selected range is empty.',
  [ErrorCode.UNSUPPORTED_FORMAT]: 'Unsupported audio format. Use WAV or MP3.',
  [ErrorCode.DECODE_FAILED]: 'Could not decode the audio file.',
  [ErrorCode.EXPORT_FAILED]: 'Could not export audio from the timeline.',
  [ErrorCode.NO_DISK_SPACE]: 'Not enough disk space for temporary audio.',
  [ErrorCode.ENGINE_FAILED]: 'Audio analysis failed.',
  [ErrorCode.ENGINE_MISSING]: 'The analysis engine is not installed.',
  [ErrorCode.MARKER_FAILED]: 'Could not create markers.',
  [ErrorCode.CANCELLED]: 'Analysis cancelled.',
  [ErrorCode.UXP_ERROR]: 'A Premiere Pro error occurred.',
};

export class BeatMarkerError extends Error {
  /**
   * @param {string} code   one of ErrorCode
   * @param {string} [userMessage] short message for the UI
   * @param {*} [details]    developer context (logged, not shown)
   */
  constructor(code, userMessage, details) {
    const msg = userMessage || DEFAULT_MESSAGE[code] || 'Something went wrong.';
    super(msg);
    this.name = 'BeatMarkerError';
    this.code = code;
    this.userMessage = msg;
    this.details = details;
  }
}

/** Normalize any thrown value into a BeatMarkerError for uniform UI handling. */
export function toBeatMarkerError(err, fallbackCode = ErrorCode.UXP_ERROR) {
  if (err instanceof BeatMarkerError) return err;
  const message = err && err.message ? err.message : String(err);
  return new BeatMarkerError(fallbackCode, DEFAULT_MESSAGE[fallbackCode], message);
}
