import { test, eq, assert } from './harness.mjs';
import { buildComment, buildLabel, isOurs, parseComment, TAG } from '../src/premiere/markerTag.js';

const downbeat = { type: 'downbeat', bar: 1, beatInBar: 1, index: 1 };
const beat = { type: 'beat', bar: 1, beatInBar: 2, index: 2 };

test('buildComment stamps the tag', () => {
  const c = buildComment(downbeat);
  assert(c.startsWith(TAG), 'starts with tag');
  assert(isOurs(c), 'recognized as ours');
});

test('user markers are never recognized as ours', () => {
  eq(isOurs('Scene 4 — pickup'), false);
  eq(isOurs(''), false);
  eq(isOurs(undefined), false);
});

test('labels read musically', () => {
  eq(buildLabel(downbeat), 'BAR 1');
  eq(buildLabel(beat), 'BEAT 2');
  eq(buildLabel({ type: 'strong', bar: 1, beatInBar: 3, index: 3 }), 'STRONG 3');
});

test('parseComment round-trips metadata', () => {
  const meta = parseComment(buildComment(beat));
  eq(meta.type, 'beat');
  eq(meta.bar, 1);
  eq(meta.beat, 2);
  eq(meta.idx, 2);
});

test('parseComment returns null for foreign comments', () => {
  eq(parseComment('my own note'), null);
});
