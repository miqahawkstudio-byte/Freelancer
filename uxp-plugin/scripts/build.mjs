/**
 * Build pluginu: bundle JS (esbuild) + kopia CSS do dist/.
 * Użycie: node scripts/build.mjs [--prod] [--watch]
 */
import { build, context } from "esbuild";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const prod = process.argv.includes("--prod");
const watch = process.argv.includes("--watch");

mkdirSync(resolve(root, "dist"), { recursive: true });

const options = {
  entryPoints: [resolve(root, "src/main.js")],
  bundle: true,
  // UXP nie uruchamia <script type="module"> (ESM) w panelu — używamy IIFE,
  // ładowanego zwykłym <script src>. `require('premierepro'|'uxp')` zostaje
  // zewnętrzny (dostarcza je runtime UXP).
  format: "iife",
  outfile: resolve(root, "dist/index.js"),
  external: ["premierepro", "uxp"],
  minify: prod,
  sourcemap: prod ? false : "inline",
  target: ["chrome98"], // UXP (Chromium)
  loader: { ".css": "text" }, // CSS wbudowany w bundel i wstrzykiwany w main.js
  logLevel: "info",
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("watch: obserwuję zmiany…");
} else {
  await build(options);
  console.log(`build ${prod ? "produkcyjny" : "developerski"} gotowy → dist/index.js`);
}
