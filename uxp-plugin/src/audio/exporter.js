/**
 * Pozyskiwanie audio z sekwencji.
 *
 * UXP nie daje dostępu do surowego PCM ścieżki audio. Oficjalna, wspierana
 * metoda to eksport przez EncoderManager z presetem audio-only (.epr → WAV),
 * respektujący zakres In/Out sekwencji:
 *
 *   EncoderManager.getManager().exportSequence(
 *     sequence, exportType, outputFile, presetFile, exportFull
 *   ) -> Promise<boolean>
 *
 * Kluczowe decyzje (zweryfikowane w oficjalnej referencji UXP):
 *  - exportType = Constants.ExportType.IMMEDIATELY → eksport synchroniczny w
 *    Premiere (bez uruchamiania AME); plik jest gotowy, gdy Promise się rozwiąże.
 *  - exportFull = (range === "full"); dla "inout" ustawiamy false → eksport
 *    zakresu In/Out.
 *  - presetFile: ścieżka do presetu .epr (audio-only WAV). Adobe nie pozwala
 *    wygenerować poprawnego presetu z kodu, więc użytkownik wskazuje własny
 *    preset w Ustawieniach (jednorazowo). Instrukcja: docs/AUDIO_PRESET.md.
 *
 * Offset timeline: eksportowany WAV zaczyna się od początku materiału
 * (dla "inout" od punktu In). Aby SRT był zgodny z sekwencją, do czasów
 * Whispera dodajemy offset = mediaStart − zeroPoint (patrz Etap 6).
 */

import { createLogger } from "../utils/logger.js";
import { AppError, ErrorCodes } from "../utils/errors.js";
import { getPPro } from "../premiere/sequence.js";
import { makeOutputPath, fileExists } from "../utils/fs.js";

const log = createLogger("audio");

/**
 * @param {object} params
 * @param {any}     params.sequence            obiekt sekwencji UXP
 * @param {"full"|"inout"} params.range
 * @param {string}  params.presetPath          ścieżka do presetu .epr (audio-only WAV)
 * @param {string}  [params.outputDirNative]   folder docelowy (nativePath); brak → temp
 * @param {number}  params.zeroPointSec
 * @param {number}  params.inPointSec
 * @param {number}  params.outPointSec
 * @param {number}  params.endSec
 * @returns {Promise<{path:string, range:string, mediaStartSec:number, offsetSec:number, durationSec:number}>}
 */
export async function exportSequenceAudio(params) {
  const {
    sequence,
    range = "full",
    presetPath,
    outputDirNative = null,
    zeroPointSec = 0,
    inPointSec = 0,
    outPointSec = 0,
    endSec = 0,
  } = params || {};

  const ppro = getPPro();
  if (!ppro) throw new AppError(ErrorCodes.AUDIO_EXPORT_FAILED, { userMessage: "Eksport audio dostępny tylko w Premiere Pro." });
  if (!sequence) throw new AppError(ErrorCodes.NO_ACTIVE_SEQUENCE);

  if (!presetPath) {
    throw new AppError(ErrorCodes.AUDIO_EXPORT_FAILED, {
      userMessage:
        "Nie wskazano presetu eksportu audio. Ustaw preset .epr (audio-only WAV) w Ustawieniach — instrukcja w docs/AUDIO_PRESET.md.",
    });
  }

  // Walidacja presetu.
  if (!(await fileExists(presetPath))) {
    throw new AppError(ErrorCodes.AUDIO_EXPORT_FAILED, {
      userMessage: "Preset eksportu audio nie istnieje pod wskazaną ścieżką. Popraw ścieżkę w Ustawieniach.",
    });
  }

  const outputPath = await makeOutputPath("wav", "psai_audio", outputDirNative);
  if (!outputPath) {
    throw new AppError(ErrorCodes.AUDIO_EXPORT_FAILED, { userMessage: "Nie udało się ustalić ścieżki wyjściowej audio." });
  }

  const exportType = resolveImmediateExportType(ppro);
  const exportFull = range !== "inout";

  // Zakres i offset względem sekwencji.
  const mediaStartSec = exportFull ? zeroPointSec : inPointSec;
  const mediaEndSec = exportFull ? endSec : outPointSec;
  const durationSec = Math.max(0, mediaEndSec - mediaStartSec);
  const offsetSec = mediaStartSec - zeroPointSec; // do dodania do czasów Whispera

  log.info("Eksport audio startuje", { range, exportFull, durationSec });

  const manager = ppro.EncoderManager.getManager();
  let ok = false;
  try {
    ok = await manager.exportSequence(sequence, exportType, outputPath, presetPath, exportFull);
  } catch (e) {
    log.error("exportSequence rzucił wyjątek", { error: String(e && e.message) });
    throw classifyExportError(e);
  }

  if (!ok) {
    throw new AppError(ErrorCodes.AUDIO_EXPORT_FAILED);
  }

  if (!(await fileExists(outputPath))) {
    throw new AppError(ErrorCodes.AUDIO_EXPORT_FAILED, {
      userMessage: "Eksport zakończył się, ale plik audio nie powstał. Sprawdź preset i miejsce na dysku.",
    });
  }

  log.info("Eksport audio zakończony", { durationSec });
  return { path: outputPath, range, mediaStartSec, offsetSec, durationSec };
}

/**
 * Zwraca stałą ExportType.IMMEDIATELY (z fallbackiem, gdy nazwa się zmieni).
 */
function resolveImmediateExportType(ppro) {
  const t = ppro?.Constants?.ExportType;
  if (t && t.IMMEDIATELY !== undefined) return t.IMMEDIATELY;
  // Ostatecznie oddajemy cokolwiek dostępne — lepsze niż undefined.
  if (t && t.QUEUE_TO_AME !== undefined) return t.QUEUE_TO_AME;
  return 0;
}

/**
 * Mapuje błędy eksportu na komunikaty domenowe (np. brak miejsca na dysku).
 */
function classifyExportError(e) {
  const msg = String((e && e.message) || "").toLowerCase();
  if (msg.includes("space") || msg.includes("disk") || msg.includes("miejsc")) {
    return new AppError(ErrorCodes.DISK_FULL, { cause: e });
  }
  return new AppError(ErrorCodes.AUDIO_EXPORT_FAILED, { cause: e });
}
