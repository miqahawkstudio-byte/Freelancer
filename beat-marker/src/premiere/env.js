/**
 * env.js — host detection and access to the Premiere UXP API object.
 *
 * The panel loads both inside Premiere (where `require('premierepro')` exists)
 * and, for development/tests, outside it. Every host call goes through here so
 * the rest of the code can assume a resolved API or a clean, typed failure —
 * never a raw ReferenceError.
 */

import { BeatMarkerError, ErrorCode } from '../utils/Errors.js';

let _ppro = null;

/** True when running inside the Premiere UXP host. */
export function isUxp() {
  // In UXP, a global `require` resolves host modules. Outside, it does not.
  return typeof require === 'function' && safeRequire('premierepro') != null;
}

/**
 * Return the Premiere Pro UXP API module (`premierepro`).
 * Throws a typed error when not running inside Premiere.
 */
export function ppro() {
  if (_ppro) return _ppro;
  const mod = safeRequire('premierepro');
  if (!mod) {
    throw new BeatMarkerError(
      ErrorCode.UXP_UNAVAILABLE,
      'Premiere Pro UXP API not available. Run this panel inside Premiere Pro 25.x or later.'
    );
  }
  _ppro = mod;
  return _ppro;
}

/** Return the active Project or throw a friendly error. */
export async function getActiveProject() {
  const api = ppro();
  // VERIFY-IN-PPRO: exact accessor name across 25.x point releases.
  const project = await api.Project.getActiveProject();
  if (!project) {
    throw new BeatMarkerError(ErrorCode.NO_PROJECT, 'No project is open.');
  }
  return project;
}

function safeRequire(name) {
  try {
    // eslint-disable-next-line no-undef
    return typeof require === 'function' ? require(name) : null;
  } catch {
    return null;
  }
}
