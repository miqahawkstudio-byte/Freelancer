/**
 * Interfejs silnika STT (wymienialny).
 *
 * Reszta aplikacji zależy wyłącznie od tego kontraktu, nie od konkretnego
 * silnika (faster-whisper / whisper.cpp / cloud). Domyślny adapter komunikuje
 * się z lokalnym backendem po HTTP (patrz transcription/client.js).
 *
 * Kontrakt zwracanej struktury:
 *   {
 *     language: "pl",
 *     segments: [
 *       { start: 2.12, end: 4.54, text: "…", words?: [ { start, end, word } ] }
 *     ]
 *   }
 */

/**
 * @typedef {Object} TranscribeOptions
 * @property {string} language        np. "pl"
 * @property {string} model           np. "large-v3"
 * @property {boolean} wordTimestamps użyj word-level timestamps
 * @property {(p:{percent:number,status:string})=>void} [onProgress]
 * @property {AbortSignal} [signal]   do anulowania
 */

/**
 * @typedef {Object} Word
 * @property {number} start
 * @property {number} end
 * @property {string} word
 */

/**
 * @typedef {Object} Segment
 * @property {number} start
 * @property {number} end
 * @property {string} text
 * @property {Word[]} [words]
 */

/**
 * @typedef {Object} TranscriptionResult
 * @property {string} language
 * @property {Segment[]} segments
 */

/**
 * @callback TranscribeFn
 * @param {string} audioFile          ścieżka do pliku audio (WAV)
 * @param {TranscribeOptions} options
 * @returns {Promise<TranscriptionResult>}
 */

// Ten plik definiuje wyłącznie kontrakt (typy). Implementacje: transcription/client.js
export const STT_RESULT_SHAPE = Object.freeze({
  language: "string",
  segments: "Segment[]",
});
