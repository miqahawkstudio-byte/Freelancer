/**
 * Bootstrap panelu Polish Subtitle AI.
 *
 * Wczytuje ustawienia, konfiguruje logger i renderuje UI. Logika pipeline
 * (sekwencja → audio → STT → segmentacja → SRT → napisy w Premiere) jest
 * podpinana w kolejnych etapach do zwróconych tu referencji kontrolek.
 */

import { loadSettings, getSettings } from "./config/settings.js";
import { configureLogger, createLogger } from "./utils/logger.js";
import { renderPanel } from "./ui/panel.js";
// CSS jest wbudowany w bundel (esbuild loader: text) i wstrzykiwany jako <style>,
// dzięki czemu nie zależymy od osobnego pliku dist/styles.css.
import styles from "./ui/styles.css";

const log = createLogger("main");

function injectStyles() {
  try {
    const style = document.createElement("style");
    style.textContent = styles;
    document.head.appendChild(style);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Nie udało się wstrzyknąć stylów", e);
  }
}

async function boot() {
  const root = document.getElementById("app");
  if (!root) return;

  injectStyles();
  await loadSettings();
  configureLogger({ devLogging: getSettings().devLogging });
  log.info("Polish Subtitle AI — start panelu");

  await renderPanel(root);
}

boot().catch((e) => {
  // Ostatnia linia obrony — nie pokazujemy stack trace jako komunikatu głównego.
  // eslint-disable-next-line no-console
  console.error("Boot error", e);
  const root = document.getElementById("app");
  if (root) {
    root.innerHTML =
      '<div class="app"><div class="section"><div class="status error">' +
      "Nie udało się uruchomić panelu. Sprawdź logi." +
      "</div></div></div>";
  }
});
