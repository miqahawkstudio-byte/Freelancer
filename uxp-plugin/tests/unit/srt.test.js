import { test } from "node:test";
import assert from "node:assert/strict";
import { secondsToSrtTime, buildSrt, sanitizeCues } from "../../src/export/srt.js";

test("secondsToSrtTime: format HH:MM:SS,mmm", () => {
  assert.equal(secondsToSrtTime(0), "00:00:00,000");
  assert.equal(secondsToSrtTime(2.12), "00:00:02,120");
  assert.equal(secondsToSrtTime(3722.12), "01:02:02,120");
  assert.equal(secondsToSrtTime(59.999), "00:00:59,999");
  assert.equal(secondsToSrtTime(-5), "00:00:00,000"); // clamp
});

test("buildSrt: numeracja, format i puste linie", () => {
  const srt = buildSrt([
    { start: 2.12, end: 4.54, lines: ["To jest przykładowy tekst."] },
    { start: 4.7, end: 7.1, lines: ["Drugi napis,", "druga linia."] },
  ]);
  const expected =
    "1\n00:00:02,120 --> 00:00:04,540\nTo jest przykładowy tekst.\n\n" +
    "2\n00:00:04,700 --> 00:00:07,100\nDrugi napis,\ndruga linia.\n";
  assert.equal(srt, expected);
});

test("buildSrt: polskie znaki zachowane", () => {
  const srt = buildSrt([{ start: 0, end: 1, lines: ["Zażółć gęślą jaźń ĄĆĘŁŃÓŚŹŻ"] }]);
  assert.ok(srt.includes("Zażółć gęślą jaźń ĄĆĘŁŃÓŚŹŻ"));
});

test("sanitizeCues: brak nakładania i chronologia", () => {
  const out = sanitizeCues([
    { start: 2.5, end: 5.0, lines: ["B"] },
    { start: 0.0, end: 3.0, lines: ["A"] }, // nieposortowane + nakładanie
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].lines[0], "A");
  assert.ok(out[0].end <= out[1].start, "brak nakładania");
  assert.ok(out[0].start < out[1].start, "chronologia");
});

test("sanitizeCues: usuwa puste i zeruje ujemny czas", () => {
  const out = sanitizeCues([
    { start: 1, end: 1, lines: ["   "] }, // puste linie → usunięte
    { start: 2, end: 2, lines: ["ok"] }, // end==start → wydłużone o EPS
  ]);
  assert.equal(out.length, 1);
  assert.ok(out[0].end > out[0].start);
});
