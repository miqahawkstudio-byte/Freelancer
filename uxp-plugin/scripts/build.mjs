/**
 * Build pluginu: bundle JS (esbuild) + kopia CSS do dist/.
 * Użycie: node scripts/build.mjs [--prod] [--watch]
 */
import { build, context } from "esbuild";
import { mkdirSync, copyFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const prod = process.argv.includes("--prod");
const watch = process.argv.includes("--watch");

mkdirSync(resolve(root, "dist"), { recursive: true });

const options = {
  entryPoints: [resolve(root, "src/main.js")],
  bundle: true,
  format: "esm",
  outfile: resolve(root, "dist/index.js"),
  external: ["premierepro", "uxp"],
  minify: prod,
  sourcemap: prod ? false : "inline",
  target: ["chrome98"], // UXP (Chromium)
  logLevel: "info",
};

function copyCss() {
  copyFileSync(resolve(root, "src/ui/styles.css"), resolve(root, "dist/styles.css"));
}

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  copyCss();
  console.log("watch: obserwuję zmiany… (CSS skopiowany)");
} else {
  await build(options);
  copyCss();
  console.log(`build ${prod ? "produkcyjny" : "developerski"} gotowy → dist/`);
}
