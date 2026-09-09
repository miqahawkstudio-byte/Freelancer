/**
 * hostRequire.js — obtain a UXP host module (e.g. 'uxp', 'premierepro').
 *
 * Reads `require` off the global object rather than referencing a bare `require`
 * identifier, so a bundler (esbuild) does NOT replace it with a shim that throws
 * "Dynamic require is not supported". In UXP, `require` is a global function; in
 * a plain Node ESM test there is no `globalThis.require`, so this returns null
 * and the app treats the host as unavailable (preview mode).
 *
 * @param {string} name
 * @returns {*} the host module, or null when not running inside UXP
 */
export function hostRequire(name) {
  try {
    const req =
      typeof globalThis !== 'undefined' && typeof globalThis.require === 'function'
        ? globalThis.require
        : null;
    return req ? req(name) : null;
  } catch {
    return null;
  }
}

/** True when running inside the UXP host (a host module resolves). */
export function hasHost() {
  return hostRequire('uxp') != null;
}
