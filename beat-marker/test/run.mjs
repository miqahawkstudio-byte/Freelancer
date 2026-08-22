/**
 * Test runner: import the harness, load every *.test.mjs, then execute.
 * Zero dependencies. Exits non-zero on any failure.
 */
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { cases } from './harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((f) => f.endsWith('.test.mjs'));
for (const f of files) {
  await import(pathToFileURL(join(here, f)).href);
}

let pass = 0;
let fail = 0;
for (const c of cases) {
  try {
    await c.fn();
    pass += 1;
    console.log(`  ✓ ${c.name}`);
  } catch (e) {
    fail += 1;
    console.log(`  ✗ ${c.name}\n      ${e.message}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed, ${cases.length} total`);
process.exit(fail === 0 ? 0 : 1);
