/**
 * Napisy w Premiere — best-effort (Etap 9).
 *
 * Stan API (zweryfikowany w oficjalnej referencji UXP):
 *  - Sequence: getCaptionTrack(index), getCaptionTrackCount() — tylko ODCZYT.
 *  - BRAK createCaptionTrack / metody tworzenia napisów na sekwencji w UXP.
 *  - Project.importFiles(filePaths, suppressUI, targetBin, asNumberedStills)
 *    — działa jak File → Import; import pliku .srt tworzy element napisów w koszu.
 *
 * Wniosek: możemy programowo ZAIMPORTOWAĆ SRT do projektu, ale NIE możemy z UXP
 * umieścić go na ścieżce napisów sekwencji. Dlatego:
 *  1) próbujemy importFiles([srt]) → element napisów w koszu,
 *  2) informujemy użytkownika, że umieszczenie na osi czasu jest ręczne
 *     (przeciągnięcie elementu na sekwencję), bo UXP nie udostępnia
 *     tworzenia ścieżki napisów.
 * Gdy import się nie powiedzie → jawny fallback (zapis SRT + import ręczny).
 *
 * Nie wymyślamy API — używamy wyłącznie udokumentowanych metod.
 */

import { createLogger } from "../utils/logger.js";
import { AppError, ErrorCodes } from "../utils/errors.js";
import { getPPro, getActiveProject } from "./sequence.js";

const log = createLogger("premiere");

/**
 * Czy w tej wersji UXP dostępny jest import plików do projektu.
 */
export function canImportToProject() {
  const ppro = getPPro();
  return !!(ppro && ppro.Project);
}

/**
 * Importuje plik SRT do projektu jako element napisów (best-effort).
 * @param {string} srtNativePath  ścieżka natywna do pliku .srt
 * @returns {Promise<{imported:boolean, placedOnTimeline:boolean, note:string}>}
 */
export async function importSrtToProject(srtNativePath) {
  const ppro = getPPro();
  if (!ppro) {
    throw new AppError(ErrorCodes.CAPTION_API_UNAVAILABLE, {
      userMessage: "Tworzenie napisów w Premiere dostępne tylko w środowisku Premiere Pro.",
    });
  }
  if (!srtNativePath) {
    throw new AppError(ErrorCodes.SRT_WRITE_FAILED, { userMessage: "Brak pliku SRT do zaimportowania." });
  }

  const project = await getActiveProject(ppro);

  let rootBin = null;
  try {
    rootBin = await project.getRootItem();
  } catch (e) {
    log.debug("getRootItem niedostępne", { error: String(e && e.message) });
  }

  try {
    // importFiles(filePaths, suppressUI, targetBin, asNumberedStills)
    const ok = await project.importFiles([srtNativePath], true, rootBin, false);
    if (!ok) {
      throw new AppError(ErrorCodes.CAPTION_API_UNAVAILABLE);
    }
    log.info("Zaimportowano SRT do projektu jako element napisów");
    return {
      imported: true,
      // UXP nie udostępnia createCaptionTrack — na oś czasu trafia ręcznie.
      placedOnTimeline: false,
      note:
        "SRT zaimportowano do projektu jako element napisów. Umieszczenie na ścieżce " +
        "napisów sekwencji wykonaj ręcznie (przeciągnij element na sekwencję) — " +
        "obecne API Premiere UXP nie pozwala zrobić tego automatycznie.",
    };
  } catch (e) {
    if (e instanceof AppError) throw e;
    log.warn("importFiles nie powiodło się", { error: String(e && e.message) });
    throw new AppError(ErrorCodes.CAPTION_API_UNAVAILABLE, { cause: e });
  }
}
