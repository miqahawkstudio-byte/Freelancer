/**
 * Pozyskiwanie audio z sekwencji.
 *
 * UXP nie daje dostępu do surowego PCM ścieżki audio. Oficjalna metoda to
 * eksport przez Encoder z presetem audio-only (.epr → WAV), respektujący
 * zakres In/Out sekwencji.
 *
 *   Encoder.exportSequence(sequence, exportType, outputFile, presetFile, exportFull)
 *
 * ETAP 4: właściwa implementacja (wybór presetu, ścieżka wyjściowa, obsługa błędów).
 */

import { createLogger } from "../utils/logger.js";
import { AppError, ErrorCodes } from "../utils/errors.js";

const log = createLogger("audio");

/**
 * Eksportuje audio z sekwencji do pliku WAV.
 * @param {object} params
 * @param {any} params.sequence   obiekt sekwencji UXP
 * @param {"full"|"inout"} params.range
 * @param {string} params.outputPath  docelowa ścieżka .wav
 * @returns {Promise<{path:string, durationSec:number, offsetSec:number}>}
 */
export async function exportSequenceAudio(params) {
  log.debug("exportSequenceAudio() — placeholder (Etap 4)", { range: params && params.range });
  throw new AppError(ErrorCodes.AUDIO_EXPORT_FAILED, {
    userMessage: "Eksport audio zostanie dodany w Etapie 4.",
  });
}
