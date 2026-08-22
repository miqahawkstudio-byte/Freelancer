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

const log = createLogger("main");

async function boot() {
  const root = document.getElementById("app");
  if (!root) return;

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
