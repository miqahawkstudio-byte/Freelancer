/**
 * Pomocnicze operacje na systemie plików (UXP localFileSystem).
 *
 * exportSequence wymaga natywnej ścieżki (string), więc pracujemy na
 * `entry.nativePath`. Moduł jest defensywny: poza UXP (testy) zwraca null,
 * zamiast rzucać.
 */

/** @returns {any|null} moduł uxp albo null. */
export function getUxp() {
  try {
    // eslint-disable-next-line no-undef
    return require("uxp");
  } catch (e) {
    return null;
  }
}

function getFs() {
  const uxp = getUxp();
  return uxp ? uxp.storage.localFileSystem : null;
}

/** Wnioskuje separator ścieżki z natywnej ścieżki (\\ na Windows, / na macOS). */
function sepOf(nativePath) {
  return nativePath && nativePath.indexOf("\\") !== -1 ? "\\" : "/";
}

/** Łączy katalog (nativePath) z nazwą pliku, dobierając separator. */
export function joinNative(dirNativePath, fileName) {
  const sep = sepOf(dirNativePath);
  const base = dirNativePath.replace(/[\\/]+$/, "");
  return `${base}${sep}${fileName}`;
}

/** Folder tymczasowy pluginu (nativePath) lub null. */
export async function getTempFolder() {
  const fs = getFs();
  if (!fs) return null;
  return fs.getTemporaryFolder();
}

/** Folder danych pluginu (nativePath) lub null. */
export async function getDataFolder() {
  const fs = getFs();
  if (!fs) return null;
  return fs.getDataFolder();
}

/**
 * Sprawdza, czy plik pod natywną ścieżką istnieje (i ma niezerowy rozmiar).
 * @param {string} nativePath
 * @returns {Promise<boolean>}
 */
export async function fileExists(nativePath) {
  const fs = getFs();
  if (!fs || !nativePath) return false;
  try {
    const entry = await fs.getEntryWithUrl(`file:${nativePath}`);
    return !!entry && entry.isFile;
  } catch (e) {
    return false;
  }
}

/**
 * Buduje unikalną ścieżkę wyjściową w podanym folderze (albo w temp).
 * @param {string} ext          rozszerzenie bez kropki, np. "wav"
 * @param {string} [prefix]
 * @param {string|null} [preferredDirNativePath]  gdy null → folder tymczasowy
 * @returns {Promise<string|null>} nativePath lub null poza UXP
 */
export async function makeOutputPath(ext, prefix = "psai", preferredDirNativePath = null) {
  let dirNative = preferredDirNativePath;
  if (!dirNative) {
    const temp = await getTempFolder();
    if (!temp) return null;
    dirNative = temp.nativePath;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 7);
  return joinNative(dirNative, `${prefix}_${stamp}_${rand}.${ext}`);
}
