import { test } from "node:test";
import assert from "node:assert/strict";
import { fpsFromTimebase, secondsOf, TICKS_PER_SECOND } from "../../src/premiere/timecode.js";

test("fpsFromTimebase: typowe timebase", () => {
  const tb = (fps) => String(Math.round(TICKS_PER_SECOND / fps));
  assert.equal(fpsFromTimebase(tb(25)), 25);
  assert.equal(fpsFromTimebase(tb(24)), 24);
  assert.equal(fpsFromTimebase(tb(30)), 30);
  // 29.97 (drop) — timebase 8475667200 ticków/klatkę
  assert.ok(Math.abs(fpsFromTimebase("8475667200") - 29.97) < 0.001);
});

test("fpsFromTimebase: dane niepoprawne → 0", () => {
  assert.equal(fpsFromTimebase(""), 0);
  assert.equal(fpsFromTimebase(null), 0);
  assert.equal(fpsFromTimebase("0"), 0);
});

test("secondsOf: różne reprezentacje czasu", () => {
  assert.equal(secondsOf({ seconds: 2.12 }), 2.12);
  assert.equal(secondsOf({ ticksNumber: TICKS_PER_SECOND }), 1);
  assert.equal(secondsOf({ ticks: String(TICKS_PER_SECOND * 2) }), 2);
  assert.equal(secondsOf(3.5), 3.5);
  assert.equal(secondsOf(null), 0);
});
