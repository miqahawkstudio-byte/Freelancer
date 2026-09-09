/**
 * Trwałe przechowywanie ustawień pluginu.
 *
 * Ustawienia zapisywane są jako JSON w folderze danych pluginu (UXP
 * localFileSystem data folder). Jeśli środowisko UXP nie jest dostępne
 * (np. testy w Node), moduł działa w trybie pamięciowym i nie rzuca wyjątków.
 *
 * API jest asynchroniczne, bo zapis na dysk w UXP jest asynchroniczny.
 */

import { DEFAULT_SETTINGS } from "./defaults.js";

const SETTINGS_FILE = "settings.json";

let cache = { ...DEFAULT_SETTINGS };
let loaded = false;

/**
 * Zwraca uchwyt do folderu danych pluginu, albo null gdy UXP niedostępne.
 */
async function getDataFolder() {
  try {
    // eslint-disable-next-line no-undef
    const uxp = require("uxp");
    return await uxp.storage.localFileSystem.getDataFolder();
  } catch (e) {
    return null;
  }
}

/**
 * Wczytuje ustawienia z dysku i łączy z wartościami domyślnymi.
 * Brakujące klucze są uzupełniane domyślnymi (bezpieczne dla migracji wersji).
 */
export async function loadSettings() {
  const folder = await getDataFolder();
  if (folder) {
    try {
      const entry = await folder.getEntry(SETTINGS_FILE);
      const text = await entry.read();
      const parsed = JSON.parse(text);
      cache = { ...DEFAULT_SETTINGS, ...parsed };
    } catch (e) {
      // Brak pliku lub błąd parsowania → używamy domyślnych.
      cache = { ...DEFAULT_SETTINGS };
    }
  }
  loaded = true;
  return { ...cache };
}

/**
 * Zapisuje bieżące ustawienia na dysk (jeśli UXP dostępne).
 */
export async function saveSettings(next) {
  cache = { ...DEFAULT_SETTINGS, ...(next || cache) };
  const folder = await getDataFolder();
  if (folder) {
    try {
      const entry = await folder.createEntry(SETTINGS_FILE, { overwrite: true });
      await entry.write(JSON.stringify(cache, null, 2));
    } catch (e) {
      // W trybie bez zapisu nie przerywamy działania pluginu.
    }
  }
  return { ...cache };
}

/**
 * Zwraca kopię bieżących ustawień (z cache).
 */
export function getSettings() {
  return { ...cache };
}

/**
 * Ustawia pojedynczą wartość i zapisuje całość.
 */
export async function setSetting(key, value) {
  cache = { ...cache, [key]: value };
  return saveSettings(cache);
}

/**
 * Przywraca ustawienia domyślne.
 */
export async function resetSettings() {
  return saveSettings({ ...DEFAULT_SETTINGS });
}

export function isLoaded() {
  return loaded;
}
