/**
 * Pakowanie pluginu do dystrybucji.
 * Kopiuje pliki runtime do build/plugin/ i (jeśli dostępne narzędzie zip)
 * tworzy build/polish-subtitle-ai.zip — plik można wczytać w UDT lub zmienić
 * rozszerzenie na .ccx.
 *
 * Użycie: node scripts/package.mjs   (uruchom po `npm run build:prod`)
 */
import { mkdirSync, copyFileSync, cpSync, existsSync, rmSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "build/plugin");

if (!existsSync(resolve(root, "dist/index.js"))) {
  console.error("Brak dist/index.js — uruchom najpierw: npm run build:prod");
  process.exit(1);
}

rmSync(resolve(root, "build"), { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// Pliki runtime pluginu.
copyFileSync(resolve(root, "manifest.json"), resolve(out, "manifest.json"));
copyFileSync(resolve(root, "index.html"), resolve(out, "index.html"));
cpSync(resolve(root, "dist"), resolve(out, "dist"), { recursive: true });
cpSync(resolve(root, "icons"), resolve(out, "icons"), { recursive: true });

console.log("Skopiowano pliki pluginu → build/plugin/");

// Próba spakowania (best-effort — wymaga narzędzia `zip`).
const zipPath = resolve(root, "build/polish-subtitle-ai.zip");
const res = spawnSync("zip", ["-r", "-q", zipPath, "."], { cwd: out, stdio: "inherit" });
if (res.status === 0) {
  console.log(`Utworzono paczkę: ${zipPath}`);
  console.log("Możesz zmienić rozszerzenie na .ccx lub wczytać folder build/plugin w UDT.");
} else {
  console.log("Narzędzie `zip` niedostępne — wczytaj folder build/plugin/ bezpośrednio w UDT (Add Plugin → manifest.json).");
}
