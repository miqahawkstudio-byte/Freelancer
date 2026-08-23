import { test } from "node:test";
import assert from "node:assert/strict";
import { segment } from "../../src/subtitles/segmenter.js";
import { buildSrt } from "../../src/export/srt.js";
import { applyTimelineOffset } from "../../src/transcription/offset.js";

// Fixture ze specyfikacji:
//   0.00 - 2.50  "To jest pierwszy test."
//   2.60 - 5.80  "To jest drugi fragment transkrypcji."
const FIXTURE = {
  language: "pl",
  duration: 5.8,
  segments: [
    { start: 0.0, end: 2.5, text: "To jest pierwszy test.", words: [] },
    { start: 2.6, end: 5.8, text: "To jest drugi fragment transkrypcji.", words: [] },
  ],
};

test("fixture (offset 0): SRT zachowuje timestampy", () => {
  const shifted = applyTimelineOffset(FIXTURE, 0);
  const cues = segment(shifted.segments);
  const srt = buildSrt(cues);
  const expected =
    "1\n00:00:00,000 --> 00:00:02,500\nTo jest pierwszy test.\n\n" +
    "2\n00:00:02,600 --> 00:00:05,800\nTo jest drugi fragment transkrypcji.\n";
  assert.equal(srt, expected);
});

test("fixture (offset 3600s = start 01:00:00): timestampy przesunięte", () => {
  const shifted = applyTimelineOffset(FIXTURE, 3600);
  const cues = segment(shifted.segments);
  const srt = buildSrt(cues);
  assert.ok(srt.includes("01:00:00,000 --> 01:00:02,500"), srt);
  assert.ok(srt.includes("01:00:02,600 --> 01:00:05,800"), srt);
});
