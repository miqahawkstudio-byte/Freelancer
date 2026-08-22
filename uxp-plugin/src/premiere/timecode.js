/**
 * Pomocnicze funkcje timecode dla Premiere Pro.
 *
 * Premiere mierzy czas w "tickach". Stała jest ustalona i wynosi
 * 254016000000 ticków na sekundę (ticks-per-second). Timebase sekwencji to
 * liczba ticków przypadająca na jedną klatkę (ticks-per-frame), więc:
 *
 *   fps = TICKS_PER_SECOND / timebaseTicks
 *
 * Obiekty czasu w UXP (TickTime) mają wygodne pole `.seconds`, którego używamy
 * do obliczeń offsetu timeline (patrz premiere/sequence.js i Etap 6).
 *
 * Logika czysta — bez zależności od UXP, testowalna w Node (Etap 11).
 */

export const TICKS_PER_SECOND = 254016000000;

/**
 * Zamienia timebase (ticks-per-frame) na FPS.
 * @param {string|number} timebaseTicks
 * @returns {number} klatki na sekundę (float, np. 23.976...) lub 0 gdy brak danych
 */
export function fpsFromTimebase(timebaseTicks) {
  const t = Number(timebaseTicks);
  if (!t || !Number.isFinite(t)) return 0;
  return TICKS_PER_SECOND / t;
}

/**
 * Zaokrągla FPS do czytelnej postaci do wyświetlenia (np. 23.976, 25, 29.97).
 * @param {number} fps
 * @returns {string}
 */
export function formatFps(fps) {
  if (!fps) return "—";
  const rounded = Math.round(fps * 1000) / 1000;
  // Liczby całkowite bez części dziesiętnej.
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/**
 * Bezpiecznie wyciąga wartość w sekundach z obiektu TickTime (albo liczby).
 * @param {any} tickTime  obiekt z polem `.seconds` lub liczba
 * @returns {number}
 */
export function secondsOf(tickTime) {
  if (tickTime == null) return 0;
  if (typeof tickTime === "number") return tickTime;
  if (typeof tickTime.seconds === "number") return tickTime.seconds;
  // Fallback: gdy mamy tylko ticks (string/number).
  if (tickTime.ticksNumber != null) return Number(tickTime.ticksNumber) / TICKS_PER_SECOND;
  if (tickTime.ticks != null) return Number(tickTime.ticks) / TICKS_PER_SECOND;
  return 0;
}
