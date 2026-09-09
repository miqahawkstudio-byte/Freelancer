/**
 * Logger.js — lightweight dev logger. Off by default; toggled from Settings.
 *
 * Logs structured lines about sequence/audio/analysis. Never logs raw audio.
 */

let _enabled = false;
const _buffer = [];
const MAX_BUFFER = 500;

export function setDevMode(on) {
  _enabled = !!on;
}

export function isDevMode() {
  return _enabled;
}

export function log(scope, message, data) {
  const entry = { t: Date.now(), scope, message, data: redact(data) };
  _buffer.push(entry);
  if (_buffer.length > MAX_BUFFER) _buffer.shift();
  if (_enabled) {
    // eslint-disable-next-line no-console
    console.log(`[BeatMarker:${scope}] ${message}`, entry.data ?? '');
  }
}

export function getBuffer() {
  return _buffer.slice();
}

/** Drop obviously heavy fields (e.g. sample arrays) from logged data. */
function redact(data) {
  if (!data || typeof data !== 'object') return data;
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (ArrayBuffer.isView(v) || Array.isArray(v)) {
      out[k] = `[${v.constructor?.name || 'array'} len=${v.length}]`;
    } else {
      out[k] = v;
    }
  }
  return out;
}
