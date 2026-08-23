/**
 * Domyślny adapter STT: klient lokalnego backendu Whisper (HTTP).
 *
 * Implementuje kontrakt z transcription/engine.js. Audio nie opuszcza komputera —
 * backend działa lokalnie (localhost) i czyta plik WAV bezpośrednio z dysku
 * (endpoint /api/transcribe_path), więc nie przesyłamy dużego pliku przez sieć.
 *
 * Przepływ: transcribe_path → polling /api/status (progress) → /api/result.
 * Anulowanie: AbortSignal → POST /api/cancel/{job_id}.
 */

import { createLogger } from "../utils/logger.js";
import { AppError, ErrorCodes } from "../utils/errors.js";

const log = createLogger("stt");

function base(url) {
  return (url || "").replace(/\/$/, "");
}

/**
 * Sprawdza dostępność backendu (GET /health).
 * @returns {Promise<boolean>}
 */
export async function pingBackend(backendUrl) {
  try {
    const res = await fetch(`${base(backendUrl)}/health`, { method: "GET" });
    return res.ok;
  } catch (e) {
    log.warn("Backend niedostępny", { url: backendUrl });
    return false;
  }
}

/**
 * Pobiera listę modeli i metadane silnika (GET /api/models).
 */
export async function getModels(backendUrl) {
  try {
    const res = await fetch(`${base(backendUrl)}/api/models`, { method: "GET" });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @type {import('./engine.js').TranscribeFn}
 * options: { backendUrl, language, model, wordTimestamps, onProgress, signal }
 */
export async function transcribe(audioFile, options) {
  const backendUrl = base(options.backendUrl);
  if (!backendUrl) throw new AppError(ErrorCodes.BACKEND_UNREACHABLE);

  if (!(await pingBackend(backendUrl))) {
    throw new AppError(ErrorCodes.BACKEND_UNREACHABLE);
  }

  const { onProgress, signal } = options;

  // 1) Zlecenie transkrypcji (backend czyta plik lokalnie).
  let jobId;
  try {
    const res = await fetch(`${backendUrl}/api/transcribe_path`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audio_path: audioFile,
        language: options.language || "pl",
        model: options.model || "large-v3",
        word_timestamps: options.wordTimestamps !== false,
      }),
    });
    if (res.status === 404) throw new AppError(ErrorCodes.AUDIO_EXPORT_FAILED, { userMessage: "Backend nie znalazł pliku audio." });
    if (res.status === 400) throw new AppError(ErrorCodes.UNSUPPORTED_FORMAT);
    if (!res.ok) throw new AppError(ErrorCodes.TRANSCRIPTION_FAILED);
    jobId = (await res.json()).job_id;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(ErrorCodes.BACKEND_UNREACHABLE, { cause: e });
  }

  log.debug("Zlecono transkrypcję", { jobId, model: options.model });

  // 2) Polling statusu + obsługa anulowania.
  let cancelled = false;
  const onAbort = async () => {
    cancelled = true;
    try {
      await fetch(`${backendUrl}/api/cancel/${jobId}`, { method: "POST" });
    } catch (e) {
      /* ignorujemy — i tak przerwiemy pętlę */
    }
  };
  if (signal) {
    if (signal.aborted) await onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    while (true) {
      if (cancelled || (signal && signal.aborted)) {
        throw new AppError(ErrorCodes.TRANSCRIPTION_CANCELLED);
      }

      let status;
      try {
        const res = await fetch(`${backendUrl}/api/status/${jobId}`, { method: "GET" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        status = await res.json();
      } catch (e) {
        throw new AppError(ErrorCodes.BACKEND_UNREACHABLE, { cause: e });
      }

      if (onProgress && typeof status.progress === "number") {
        onProgress({ percent: status.progress, status: status.status_text || "Transkrypcja audio…" });
      }

      if (status.status === "done") break;
      if (status.status === "cancelled") throw new AppError(ErrorCodes.TRANSCRIPTION_CANCELLED);
      if (status.status === "error") {
        if (status.error === "audio_not_found") {
          throw new AppError(ErrorCodes.AUDIO_EXPORT_FAILED, { userMessage: "Backend nie znalazł pliku audio." });
        }
        throw new AppError(ErrorCodes.TRANSCRIPTION_FAILED);
      }

      await sleep(600);
    }

    // 3) Pobranie wyniku.
    const res = await fetch(`${backendUrl}/api/result/${jobId}`, { method: "GET" });
    if (!res.ok) throw new AppError(ErrorCodes.TRANSCRIPTION_FAILED);
    const result = await res.json();

    return {
      language: result.language || "pl",
      duration: result.duration || 0,
      segments: Array.isArray(result.segments) ? result.segments : [],
    };
  } finally {
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}
