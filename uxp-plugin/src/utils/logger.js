/**
 * Prosty logger dla trybu developerskiego.
 *
 * Zasady:
 * - logi pomagają diagnozować: Premiere API, audio extraction, STT, segmentację, eksport SRT,
 * - NIE zapisujemy pełnego audio ani pełnej transkrypcji (tylko metadane / skróty),
 * - w trybie produkcyjnym (devLogging=false) logujemy wyłącznie ostrzeżenia i błędy.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

let enabled = false; // devLogging
let minLevel = LEVELS.warn;
const buffer = []; // ostatnie wpisy (do ewentualnego podglądu w UI)
const BUFFER_MAX = 300;

export function configureLogger({ devLogging }) {
  enabled = !!devLogging;
  minLevel = enabled ? LEVELS.debug : LEVELS.warn;
}

/**
 * Skraca tekst, aby nie logować pełnych transkrypcji.
 */
export function truncate(text, max = 60) {
  if (typeof text !== "string") return text;
  return text.length <= max ? text : `${text.slice(0, max)}… (+${text.length - max})`;
}

function emit(level, scope, message, data) {
  if (LEVELS[level] < minLevel) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    data,
  };
  buffer.push(entry);
  if (buffer.length > BUFFER_MAX) buffer.shift();

  const line = `[${entry.ts}] [${level.toUpperCase()}] [${scope}] ${message}`;
  // eslint-disable-next-line no-console
  const fn = console[level] || console.log;
  data !== undefined ? fn(line, data) : fn(line);
}

/**
 * Tworzy logger z przypiętym zakresem (np. "premiere", "audio", "stt").
 */
export function createLogger(scope) {
  return {
    debug: (msg, data) => emit("debug", scope, msg, data),
    info: (msg, data) => emit("info", scope, msg, data),
    warn: (msg, data) => emit("warn", scope, msg, data),
    error: (msg, data) => emit("error", scope, msg, data),
  };
}

export function getLogBuffer() {
  return [...buffer];
}

export function clearLogBuffer() {
  buffer.length = 0;
}
