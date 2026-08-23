/**
 * Zapis pliku SRT na dysk (UXP localFileSystem), kodowanie UTF-8.
 *
 * Dwie drogi:
 *  - saveSrt(content, {dirNative, fileName}) — zapis do wskazanego folderu
 *    (np. folder eksportu z Ustawień) lub do folderu danych pluginu,
 *  - pickAndSaveSrt(content, fileName) — dialog „Zapisz jako".
 *
 * Otwarcie folderu z plikiem: revealFile(nativePath).
 */

import { createLogger } from "../utils/logger.js";
import { AppError, ErrorCodes } from "../utils/errors.js";
import { getUxp, getDataFolder, joinNative } from "../utils/fs.js";

const log = createLogger("export");

function utf8Format() {
  const uxp = getUxp();
  return uxp && uxp.storage && uxp.storage.formats ? uxp.storage.formats.utf8 : undefined;
}

async function folderFromNative(dirNative) {
  const uxp = getUxp();
  if (!uxp || !dirNative) return null;
  try {
    const entry = await uxp.storage.localFileSystem.getEntryWithUrl(`file:${dirNative}`);
    return entry && entry.isFolder ? entry : null;
  } catch (e) {
    return null;
  }
}

/**
 * Zapisuje SRT do folderu (wskazanego lub danych pluginu).
 * @returns {Promise<{path:string, fileName:string}>}
 */
export async function saveSrt(content, { dirNative = null, fileName = "napisy.srt" } = {}) {
  const uxp = getUxp();
  if (!uxp) throw new AppError(ErrorCodes.SRT_WRITE_FAILED, { userMessage: "Zapis dostępny tylko w środowisku pluginu." });

  let folder = dirNative ? await folderFromNative(dirNative) : null;
  if (!folder) folder = await getDataFolder();
  if (!folder) throw new AppError(ErrorCodes.SRT_WRITE_FAILED);

  try {
    const file = await folder.createFile(fileName, { overwrite: true });
    await file.write(content, { format: utf8Format() });
    const path = file.nativePath || joinNative(folder.nativePath || "", fileName);
    log.info("Zapisano SRT", { fileName });
    return { path, fileName };
  } catch (e) {
    log.error("Błąd zapisu SRT", { error: String(e && e.message) });
    const msg = String((e && e.message) || "").toLowerCase();
    if (msg.includes("space") || msg.includes("disk")) throw new AppError(ErrorCodes.DISK_FULL, { cause: e });
    throw new AppError(ErrorCodes.SRT_WRITE_FAILED, { cause: e });
  }
}

/**
 * Dialog „Zapisz jako" i zapis SRT.
 * @returns {Promise<{path:string, fileName:string}|null>} null gdy anulowano
 */
export async function pickAndSaveSrt(content, fileName = "napisy.srt") {
  const uxp = getUxp();
  if (!uxp) throw new AppError(ErrorCodes.SRT_WRITE_FAILED);
  let file;
  try {
    file = await uxp.storage.localFileSystem.getFileForSaving(fileName, { types: ["srt"] });
  } catch (e) {
    throw new AppError(ErrorCodes.SRT_WRITE_FAILED, { cause: e });
  }
  if (!file) return null; // anulowano
  try {
    await file.write(content, { format: utf8Format() });
    return { path: file.nativePath || fileName, fileName: file.name || fileName };
  } catch (e) {
    throw new AppError(ErrorCodes.SRT_WRITE_FAILED, { cause: e });
  }
}

/**
 * Otwiera folder zawierający plik (albo sam plik) w systemowym menedżerze.
 */
export async function revealFile(nativePath) {
  const uxp = getUxp();
  if (!uxp || !nativePath) return false;
  try {
    if (uxp.shell && uxp.shell.openPath) {
      await uxp.shell.openPath(nativePath);
      return true;
    }
  } catch (e) {
    log.warn("Nie udało się otworzyć folderu", { error: String(e && e.message) });
  }
  return false;
}
