import { test } from "node:test";
import assert from "node:assert/strict";
import { applyTimelineOffset } from "../../src/transcription/offset.js";

const sample = {
  language: "pl",
  duration: 5.8,
  segments: [
    { start: 0.0, end: 2.5, text: "A", words: [{ start: 0.0, end: 0.3, word: "A" }] },
    { start: 2.6, end: 5.8, text: "B", words: [] },
  ],
};

test("offset 0 (cała sekwencja) nie zmienia czasów", () => {
  const r = applyTimelineOffset(sample, 0);
  assert.deepEqual(
    r.segments.map((s) => [s.start, s.end]),
    [[0.0, 2.5], [2.6, 5.8]]
  );
});

test("offset dodatni (In/Out) przesuwa segmenty i słowa", () => {
  const r = applyTimelineOffset(sample, 12);
  assert.deepEqual(
    r.segments.map((s) => [s.start, s.end]),
    [[12.0, 14.5], [14.6, 17.8]]
  );
  assert.deepEqual(r.segments[0].words[0], { start: 12.0, end: 12.3, word: "A" });
});

test("offset nie mutuje wejścia; clamp do 0", () => {
  const before = sample.segments[0].start;
  const r = applyTimelineOffset(sample, -100);
  assert.equal(sample.segments[0].start, before, "wejście nietknięte");
  assert.ok(r.segments[0].start >= 0, "clamp >= 0");
});
