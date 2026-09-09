/**
 * Generator SRT (logika czysta, testowalna w Node).
 *
 * Wymagania:
 *  - UTF-8, poprawne polskie znaki (ą ć ę ł ń ó ś ź ż),
 *  - numeracja od 1,
 *  - format HH:MM:SS,mmm,
 *  - brak nakładających się napisów, chronologiczna kolejność,
 *  - 1..maxLines linii na napis.
 *
 * Zapis pliku (UXP FS) jest w osobnym module: export/writer.js — ten plik nie
 * zależy od UXP i jest w pełni testowalny.
 */

/**
 * Konwersja sekund → timecode SRT "HH:MM:SS,mmm".
 * @param {number} seconds  >= 0
 * @returns {string}
 */
export function secondsToSrtTime(seconds) {
  const clamped = Math.max(0, Number(seconds) || 0);
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
 * Porządkuje cue: sortuje chronologicznie, usuwa puste, wymusza brak nakładania
 * i dodatni czas trwania. Nie zmienia treści.
 * @param {{start:number,end:number,lines:string[]}[]} cues
 * @returns {{start:number,end:number,lines:string[]}[]}
 */
export function sanitizeCues(cues) {
  const EPS = 0.001;
  const cleaned = (cues || [])
    .map((c) => ({
      start: Math.max(0, Number(c.start) || 0),
      end: Math.max(0, Number(c.end) || 0),
      lines: (c.lines || []).map((l) => String(l).trim()).filter(Boolean),
    }))
    .filter((c) => c.lines.length > 0)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const out = [];
  for (const c of cleaned) {
    if (c.end <= c.start) c.end = c.start + EPS;
    if (out.length) {
      const prev = out[out.length - 1];
      // Brak nakładania: bieżący nie zaczyna się przed końcem poprzedniego.
      if (c.start < prev.end) {
        c.start = prev.end;
        if (c.end <= c.start) c.end = c.start + EPS;
      }
    }
    out.push(c);
  }
  return out;
}

/**
 * Buduje treść pliku SRT z listy cue.
 * @param {{start:number,end:number,lines:string[]}[]} cues
 * @returns {string}
 */
export function buildSrt(cues) {
  const clean = sanitizeCues(cues);
  const blocks = [];
  let index = 1;
  for (const c of clean) {
    const time = `${secondsToSrtTime(c.start)} --> ${secondsToSrtTime(c.end)}`;
    blocks.push(`${index}\n${time}\n${c.lines.join("\n")}`);
    index += 1;
  }
  // Pusta linia między blokami; końcowy znak nowej linii.
  return blocks.join("\n\n") + (blocks.length ? "\n" : "");
}
