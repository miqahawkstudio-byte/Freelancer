/**
 * Segmentacja napisów (logika czysta, bez zależności od UXP — testowalna w Node).
 *
 * Wejście: segmenty transkrypcji (po przesunięciu o offset timeline), najlepiej
 * z word-level timestamps. Wyjście: lista "cue" gotowych do zapisania w SRT.
 *
 * Zasady (domyślne, konfigurowalne):
 *  - max 42 znaki / linia, max 2 linie, preferencja 32–42 znaki,
 *  - nie dzielimy słów,
 *  - podział wg: końców zdań, przecinków, naturalnych pauz (przerwy między
 *    słowami), pojemności linii i czasu trwania,
 *  - unikamy „sierot" (pojedyncze krótkie słowo w linii),
 *  - nie rozdzielamy liczb od jednostek ani (w miarę możliwości) imion/nazwisk,
 *  - czas: min 1000 ms / max 7000 ms; zbyt długie dzielimy, zbyt krótkie
 *    wydłużamy BEZ nakładania na kolejny napis.
 */

const INF = Number.POSITIVE_INFINITY;

const DEFAULTS = {
  maxCharsPerLine: 42,
  maxLines: 2,
  preferredMinChars: 32,
  preferredMaxChars: 42,
  minDurationMs: 1000,
  maxDurationMs: 7000,
  pauseThresholdSec: 0.6, // przerwa między słowami sugerująca podział
  mergeGapSec: 0.4, // maksymalna przerwa przy łączeniu krótkich fragmentów
  mergeTinyChars: 15, // fragment krótszy niż tyle znaków może zostać dołączony
};

// ---------- Klasyfikacja tokenów ----------

export function isSentenceEnd(token) {
  return /[.!?…]["»)\]]?$/.test(token || "");
}
export function isClauseEnd(token) {
  return /[,;:–—-]$/.test(token || "");
}
export function isNumberToken(token) {
  return /\d/.test(token || "") && /^[\d.,%°:/-]+$/.test(token || "");
}
function isCapitalized(token) {
  if (!token) return false;
  const c = token[0];
  return c === c.toUpperCase() && c !== c.toLowerCase();
}

// ---------- Łamanie linii (programowanie dynamiczne) ----------

function lineLength(tokens, i, j) {
  let len = 0;
  for (let k = i; k < j; k++) len += tokens[k].length;
  return len + (j - i - 1); // spacje między słowami
}

function lineCost(tokens, i, j, n, o) {
  const L = lineLength(tokens, i, j);
  if (L > o.maxCharsPerLine && j - i > 1) return INF; // za długa (chyba że pojedynczy token)

  let cost;
  if (L < o.preferredMinChars) cost = (o.preferredMinChars - L) * (o.preferredMinChars - L);
  else if (L > o.preferredMaxChars) cost = (L - o.preferredMaxChars) * (L - o.preferredMaxChars) * 2;
  else cost = 0;

  if (L > o.maxCharsPerLine && j - i === 1) cost += 100 + (L - o.maxCharsPerLine) * 50; // wymuszony overflow

  // Sierota: pojedyncze, krótkie słowo w linii.
  if (j - i === 1 && L < 8) cost += 40;

  const last = tokens[j - 1];
  if (isSentenceEnd(last)) cost -= 15;
  else if (isClauseEnd(last)) cost -= 6;

  // Nie kończymy linii na liczbie (liczba + jednostka razem).
  if (j < n && isNumberToken(last)) cost += 60;
  // Unikamy rozdzielania imion/nazwisk (dwa słowa z wielkiej litery).
  if (j < n && isCapitalized(last) && isCapitalized(tokens[j])) cost += 25;

  return cost;
}

/**
 * Układa tokeny w <= maxLines linii (każda <= maxChars), minimalizując „badness".
 * @returns {{lines:string[], cost:number, maxLen:number}|null}
 */
export function layoutBlock(tokens, options) {
  const o = { ...DEFAULTS, ...(options || {}) };
  const n = tokens.length;
  if (n === 0) return { lines: [], cost: 0, maxLen: 0 };

  const memo = new Map();
  const key = (i, k) => i * 100 + k;

  function solve(i, k) {
    if (i === n) return { cost: 0, lines: [] };
    if (k === 0) return { cost: INF, lines: null };
    const mk = key(i, k);
    if (memo.has(mk)) return memo.get(mk);

    let best = { cost: INF, lines: null };
    for (let j = i + 1; j <= n; j++) {
      const L = lineLength(tokens, i, j);
      if (L > o.maxCharsPerLine && j > i + 1) break; // dłuższe linie nie pomogą
      const lc = lineCost(tokens, i, j, n, o);
      if (!Number.isFinite(lc)) continue;
      const rest = solve(j, k - 1);
      if (rest.lines === null) continue;
      const total = lc + rest.cost;
      if (total < best.cost) {
        best = { cost: total, lines: [tokens.slice(i, j).join(" ")].concat(rest.lines) };
      }
    }
    memo.set(mk, best);
    return best;
  }

  const res = solve(0, o.maxLines);
  if (res.lines === null) return null;
  const maxLen = res.lines.reduce((m, l) => Math.max(m, l.length), 0);
  return { lines: res.lines, cost: res.cost, maxLen };
}

/** Czy blok słów mieści się w limitach (bez wymuszonego overflow). */
function fits(words, o) {
  const lay = layoutBlock(words.map((w) => w.word), o);
  return !!lay && lay.maxLen <= o.maxCharsPerLine;
}

function charLen(words) {
  return words.reduce((s, w, idx) => s + w.word.length + (idx ? 1 : 0), 0);
}

// ---------- Budowa bloków ze strumienia słów ----------

function flattenWords(segments) {
  const words = [];
  for (const seg of segments || []) {
    if (Array.isArray(seg.words) && seg.words.length) {
      for (const w of seg.words) {
        const token = (w.word || "").trim();
        if (token) words.push({ start: Number(w.start), end: Number(w.end), word: token });
      }
    } else {
      // Brak word-timestamps: syntezujemy równomiernie w obrębie segmentu.
      const toks = (seg.text || "").trim().split(/\s+/).filter(Boolean);
      const dur = Math.max(0, Number(seg.end) - Number(seg.start));
      const per = toks.length ? dur / toks.length : 0;
      toks.forEach((t, i) => {
        words.push({
          start: Number(seg.start) + i * per,
          end: Number(seg.start) + (i + 1) * per,
          word: t,
        });
      });
    }
  }
  return words;
}

function buildBlocks(words, o) {
  const blocks = [];
  let cur = [];

  for (let idx = 0; idx < words.length; idx++) {
    const w = words[idx];

    if (cur.length) {
      const gap = w.start - cur[cur.length - 1].end;
      const durIfAdd = w.end - cur[0].start;
      const tentative = cur.concat([w]);

      // Podział przy naturalnej pauzie, gdy blok ma już rozsądną długość.
      if (gap > o.pauseThresholdSec && charLen(cur) >= o.preferredMinChars) {
        blocks.push(cur);
        cur = [w];
        continue;
      }
      // Podział przy braku miejsca lub przekroczeniu maks. czasu.
      if (!fits(tentative, o) || durIfAdd * 1000 > o.maxDurationMs) {
        blocks.push(cur);
        cur = [w];
        continue;
      }
      cur = tentative;
    } else {
      cur = [w];
    }

    // Proaktywny podział na końcu zdania.
    if (isSentenceEnd(cur[cur.length - 1].word)) {
      blocks.push(cur);
      cur = [];
    }
  }
  if (cur.length) blocks.push(cur);
  return blocks;
}

function mergeShortBlocks(blocks, o) {
  const out = [];
  for (const b of blocks) {
    if (out.length) {
      const a = out[out.length - 1];
      const combined = a.concat(b);
      const gap = b[0].start - a[a.length - 1].end;
      const dur = b[b.length - 1].end - a[0].start;
      // Łączymy tylko gdy jeden z fragmentów jest bardzo krótki (np. wtrącenie
      // „Tak.", „No."), a nie dwa pełne, czytelne zdania.
      const tiny = Math.min(charLen(a), charLen(b)) < o.mergeTinyChars;
      if (tiny && gap <= o.mergeGapSec && dur * 1000 <= o.maxDurationMs && fits(combined, o)) {
        out[out.length - 1] = combined;
        continue;
      }
    }
    out.push(b);
  }
  return out;
}

// ---------- Korekta czasu (min/max, brak nakładania) ----------

function fixTimings(cues, o) {
  const minS = o.minDurationMs / 1000;
  const maxS = o.maxDurationMs / 1000;
  const EPS = 0.001;

  // 1) Ogranicz maksymalny czas.
  for (const c of cues) {
    if (c.end - c.start > maxS) c.end = c.start + maxS;
    if (c.end <= c.start) c.end = c.start + EPS;
  }
  // 2) Brak nakładania + wydłużenie do minimum w dostępnym miejscu.
  for (let i = 0; i < cues.length; i++) {
    const nextStart = i + 1 < cues.length ? cues[i + 1].start : INF;
    if (cues[i].end > nextStart) cues[i].end = nextStart - EPS;
    if (cues[i].end - cues[i].start < minS) {
      cues[i].end = Math.min(cues[i].start + minS, nextStart - EPS);
    }
    if (cues[i].end <= cues[i].start) cues[i].end = cues[i].start + EPS;
  }
  return cues;
}

/**
 * Główna funkcja segmentacji.
 * @param {import('../transcription/engine.js').Segment[]} segments
 * @param {object} [options]
 * @returns {{start:number,end:number,lines:string[]}[]}
 */
export function segment(segments, options) {
  const o = { ...DEFAULTS, ...(options || {}) };
  const words = flattenWords(segments).filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end));
  if (!words.length) return [];

  let blocks = buildBlocks(words, o);
  blocks = mergeShortBlocks(blocks, o);

  const cues = [];
  for (const b of blocks) {
    if (!b.length) continue;
    const lay = layoutBlock(b.map((w) => w.word), o);
    if (!lay || !lay.lines.length) continue;
    cues.push({ start: b[0].start, end: b[b.length - 1].end, lines: lay.lines });
  }

  cues.sort((a, b) => a.start - b.start);
  return fixTimings(cues, o);
}
