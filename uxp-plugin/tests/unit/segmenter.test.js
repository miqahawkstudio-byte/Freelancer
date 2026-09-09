import { test } from "node:test";
import assert from "node:assert/strict";
import {
  segment,
  layoutBlock,
  isSentenceEnd,
  isClauseEnd,
  isNumberToken,
} from "../../src/subtitles/segmenter.js";

const mk = (arr) => ({
  start: arr[0][0],
  end: arr[arr.length - 1][1],
  text: arr.map((a) => a[2]).join(" "),
  words: arr.map((a) => ({ start: a[0], end: a[1], word: a[2] })),
});

test("klasyfikacja tokenów", () => {
  assert.ok(isSentenceEnd("koniec."));
  assert.ok(isSentenceEnd("tak?"));
  assert.ok(!isSentenceEnd("słowo"));
  assert.ok(isClauseEnd("przecinek,"));
  assert.ok(isNumberToken("25"));
  assert.ok(isNumberToken("3,5"));
  assert.ok(!isNumberToken("dom"));
});

test("layoutBlock: nie dzieli słów i respektuje maxChars", () => {
  const tokens = "Dzisiaj rano poszedłem do sklepu żeby kupić świeże pieczywo".split(" ");
  const lay = layoutBlock(tokens, { maxCharsPerLine: 42, maxLines: 2 });
  assert.ok(lay, "layout istnieje");
  assert.ok(lay.lines.length <= 2);
  for (const line of lay.lines) assert.ok(line.length <= 42, `linia <=42: "${line}"`);
  // Suma słów zachowana (brak zgubionych/rozdzielonych słów).
  assert.equal(lay.lines.join(" ").split(" ").length, tokens.length);
});

test("layoutBlock: liczba i jednostka nie są rozdzielane", () => {
  const lay = layoutBlock(["Miał", "około", "25", "kilogramów", "bagażu"], {
    maxCharsPerLine: 42,
    maxLines: 2,
  });
  const joined = lay.lines.join(" | ");
  // "25 kilogramów" musi zostać w jednej linii (nie na granicy łamania)
  assert.ok(/25 kilogramów/.test(joined), joined);
});

test("segment: fixture zachowuje timestampy i tekst", () => {
  const cues = segment([
    { start: 0.0, end: 2.5, text: "To jest pierwszy test." },
    { start: 2.6, end: 5.8, text: "To jest drugi fragment transkrypcji." },
  ]);
  const near = (a, b) => Math.abs(a - b) < 1e-3;
  assert.equal(cues.length, 2);
  assert.deepEqual(cues[0].lines, ["To jest pierwszy test."]);
  assert.ok(near(cues[0].start, 0.0) && near(cues[0].end, 2.5));
  assert.deepEqual(cues[1].lines, ["To jest drugi fragment transkrypcji."]);
  assert.ok(near(cues[1].start, 2.6) && near(cues[1].end, 5.8));
});

test("segment: długie zdanie → 2 linie, każda <= 42", () => {
  const cues = segment([
    mk([
      [0, 0.3, "Dzisiaj"], [0.3, 0.6, "rano"], [0.6, 0.9, "poszedłem"], [0.9, 1.2, "do"],
      [1.2, 1.5, "sklepu"], [1.5, 1.8, "żeby"], [1.8, 2.1, "kupić"], [2.1, 2.4, "świeże"],
      [2.4, 2.9, "pieczywo."],
    ]),
  ]);
  assert.equal(cues.length, 1);
  assert.ok(cues[0].lines.length <= 2);
  for (const l of cues[0].lines) assert.ok(l.length <= 42);
});

test("segment: brak nakładania i chronologia", () => {
  const cues = segment([
    mk([[10.0, 10.2, "Tak."]]),
    mk([[10.4, 12.9, "To"], [12.9, 13.0, "jest"], [13.0, 13.4, "wypowiedź."]]),
    mk([[13.6, 20.0, "Bardzo"], [20.0, 21.0, "długa."]]),
  ]);
  for (let i = 1; i < cues.length; i++) {
    assert.ok(cues[i].start >= cues[i - 1].end - 1e-6, "brak nakładania");
    assert.ok(cues[i].start >= cues[i - 1].start, "chronologia");
  }
});

test("segment: maksymalny czas trwania jest ograniczany", () => {
  const cues = segment(
    [mk([[0, 0.2, "Słowo"], [10, 10.2, "drugie."]])],
    { maxDurationMs: 7000 }
  );
  for (const c of cues) assert.ok((c.end - c.start) * 1000 <= 7000 + 1, `<=7000ms: ${c.end - c.start}`);
});
