/**
 * Warstwa dostępu do Premiere Pro (UXP DOM).
 *
 * ETAP 2: szkielet interfejsu. Właściwa implementacja odczytu sekwencji,
 * ścieżek audio i zakresu timeline powstaje w Etapie 3, a offset timecode
 * w Etapie 6. Ten moduł jest jedynym miejscem, które importuje 'premierepro',
 * dzięki czemu reszta aplikacji jest niezależna od API Adobe (i testowalna).
 *
 * Nie wymyślamy API — używamy wyłącznie udokumentowanych metod UXP:
 *   require('premierepro') → app.getActiveProject() / project.getActiveSequence()
 *   sequence.getAudioTrackCount(), sequence.getAudioTrack(index)
 *   ustawienia sekwencji (timebase, video frame rate) do konwersji ticków→sekundy
 */

import { createLogger } from "../utils/logger.js";
import { AppError, ErrorCodes } from "../utils/errors.js";

const log = createLogger("premiere");

/**
 * @returns {any|null} obiekt premierepro albo null gdy poza Premiere (np. testy).
 */
export function getPPro() {
  try {
    // eslint-disable-next-line no-undef
    return require("premierepro");
  } catch (e) {
    return null;
  }
}

/**
 * Zwraca aktywną sekwencję lub rzuca AppError(NO_ACTIVE_SEQUENCE).
 * ETAP 3: implementacja.
 */
export async function getActiveSequence() {
  const ppro = getPPro();
  if (!ppro) throw new AppError(ErrorCodes.NO_ACTIVE_SEQUENCE);
  const project = await ppro.Project.getActiveProject();
  const sequence = project && (await project.getActiveSequence());
  if (!sequence) throw new AppError(ErrorCodes.NO_ACTIVE_SEQUENCE);
  return sequence;
}

/**
 * Metadane sekwencji potrzebne UI i timecode.
 * ETAP 3/6: pełna implementacja (fps, timebase, zeroPoint, in/out).
 * @returns {Promise<{name:string, fps:number, audioTracks:{index:number,name:string}[]}>}
 */
export async function describeActiveSequence() {
  log.debug("describeActiveSequence() — placeholder (Etap 3)");
  // Placeholder do czasu Etapu 3, aby panel działał bez Premiere.
  return {
    name: "(brak — Etap 3)",
    fps: 0,
    audioTracks: [],
    available: getPPro() !== null,
  };
}
