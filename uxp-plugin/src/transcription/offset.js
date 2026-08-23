/**
 * Przesunięcie czasów transkrypcji do czasu sekwencji (offset timeline).
 *
 * Whisper zwraca czasy względem pliku audio (od 0). Wyeksportowany WAV zaczyna
 * się od początku materiału: dla zakresu In/Out od punktu In, dla całości od
 * początku sekwencji. Aby SRT był zgodny z importem do Premiere (gdzie
 * 00:00:00 = początek sekwencji / zeroPoint), do każdego czasu dodajemy:
 *
 *   offset = mediaStart − zeroPoint
 *
 * (patrz audio/exporter.js, które zwraca offsetSec).
 *   - eksport całości: mediaStart = zeroPoint → offset = 0
 *   - eksport In/Out:  mediaStart = inPoint  → offset = inPoint − zeroPoint
 *
 * Logika czysta — testowalna w Node (Etap 11).
 */

/**
 * Zwraca nowy wynik z czasami przesuniętymi o offsetSec (bez mutacji wejścia).
 * @param {{language:string,duration?:number,segments:Array}} result
 * @param {number} offsetSec
 * @returns {{language:string,duration:number,segments:Array}}
 */
export function applyTimelineOffset(result, offsetSec) {
  const off = Number(offsetSec) || 0;
  const shift = (t) => Math.max(0, Number(t) + off);

  const segments = (result.segments || []).map((s) => ({
    start: shift(s.start),
    end: shift(s.end),
    text: s.text,
    words: Array.isArray(s.words)
      ? s.words.map((w) => ({ start: shift(w.start), end: shift(w.end), word: w.word }))
      : [],
  }));

  return {
    language: result.language || "pl",
    duration: result.duration || 0,
    segments,
  };
}
