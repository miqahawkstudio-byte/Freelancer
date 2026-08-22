/**
 * Generator SRT (logika czysta, testowalna w Node).
 *
 * ETAP 8: pełna implementacja. Wymagania:
 *  - UTF-8, poprawne polskie znaki (ą ć ę ł ń ó ś ź ż),
 *  - numeracja od 1,
 *  - format HH:MM:SS,mmm,
 *  - brak nakładających się napisów, chronologiczna kolejność.
 *
 * Formatowanie czasu jest tu wydzielone (secondsToSrtTime) i będzie objęte
 * testami jednostkowymi (Etap 11).
 */

/**
 * Konwersja sekund → timecode SRT "HH:MM:SS,mmm".
 * @param {number} seconds  >= 0
 * @returns {string}
 */
export function secondsToSrtTime(seconds) {
  const clamped = Math.max(0, seconds);
  const totalMs = Math.round(clamped * 1000);
  const ms = totalMs % 1000;
  const totalSec = (totalMs - ms) / 1000;
  const s = totalSec % 60;
  const totalMin = (totalSec - s) / 60;
  const m = totalMin % 60;
  const h = (totalMin - m) / 60;
  const p2 = (n) => String(n).padStart(2, "0");
  const p3 = (n) => String(n).padStart(3, "0");
  return `${p2(h)}:${p2(m)}:${p2(s)},${p3(ms)}`;
}

/**
 * Buduje treść pliku SRT z listy cue.
 * @param {import('../subtitles/segmenter.js').Cue[]} cues
 * @returns {string}
 */
export function buildSrt(cues) {
  // Placeholder do Etapu 8 (walidacja nakładania, numeracja, złożenie linii).
  void cues;
  throw new Error("buildSrt(): implementacja w Etapie 8");
}
