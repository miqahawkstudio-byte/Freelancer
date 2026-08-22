/**
 * Segmentacja napisów (logika czysta, bez zależności od UXP — testowalna w Node).
 *
 * ETAP 7: pełny algorytm. Bierze pod uwagę: końce zdań, przecinki, naturalne
 * pauzy (z word-timestamps), długość tekstu, czytelność, max znaków/linia,
 * max linii, min/max czas trwania. Nie dzieli słów, imion/nazwisk, liczb
 * z jednostkami ani naturalnych fraz. Nie zostawia „sierot" na końcu/początku linii.
 *
 * Kontrakt wejścia: TranscriptionResult (patrz transcription/engine.js) po
 * przesunięciu o offset timeline (patrz Etap 6).
 */

/**
 * @typedef {Object} Cue
 * @property {number} start  sekundy (względem timeline)
 * @property {number} end    sekundy (względem timeline)
 * @property {string[]} lines  1..maxLines linii tekstu
 */

/**
 * @param {import('../transcription/engine.js').Segment[]} segments
 * @param {object} opts  { maxCharsPerLine, maxLines, minDurationMs, maxDurationMs, ... }
 * @returns {Cue[]}
 */
export function segment(segments, opts) {
  // Placeholder do Etapu 7.
  void segments;
  void opts;
  throw new Error("segment(): implementacja w Etapie 7");
}
