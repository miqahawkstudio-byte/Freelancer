/**
 * Domyślny adapter STT: klient lokalnego backendu Whisper (HTTP).
 *
 * Implementuje kontrakt z transcription/engine.js. Audio nie opuszcza komputera —
 * backend działa lokalnie (localhost). ETAP 5/6: pełna implementacja (upload pliku,
 * polling statusu, word-timestamps, cancel przez AbortSignal).
 */

import { createLogger } from "../utils/logger.js";
import { AppError, ErrorCodes } from "../utils/errors.js";

const log = createLogger("stt");

/**
 * Sprawdza dostępność backendu (GET /health).
 * @param {string} backendUrl
 * @returns {Promise<boolean>}
 */
export async function pingBackend(backendUrl) {
  try {
    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/health`, { method: "GET" });
    return res.ok;
  } catch (e) {
    log.warn("Backend niedostępny", { url: backendUrl });
    return false;
  }
}

/**
 * @type {import('./engine.js').TranscribeFn}
 */
export async function transcribe(audioFile, options) {
  log.debug("transcribe() — placeholder (Etap 5/6)", { model: options && options.model });
  const ok = await pingBackend(options.backendUrl || "");
  if (!ok) throw new AppError(ErrorCodes.BACKEND_UNREACHABLE);
  throw new AppError(ErrorCodes.TRANSCRIPTION_FAILED, {
    userMessage: "Transkrypcja zostanie podłączona w Etapie 5/6.",
  });
}
