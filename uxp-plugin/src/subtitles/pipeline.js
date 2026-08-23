/**
 * Orkiestracja pełnego przepływu generowania napisów.
 *
 *   sekwencja → eksport audio → STT (Whisper) → offset timeline
 *             → segmentacja → SRT
 *
 * Zapewnia: raportowanie postępu (z pasmami procentowymi na etap), anulowanie
 * (AbortSignal), izolację wybranej ścieżki audio i sprzątanie stanu (przywrócenie
 * wyciszeń). Błędy są błędami domenowymi (AppError) — UI pokazuje userMessage.
 */

import { createLogger } from "../utils/logger.js";
import { AppError, ErrorCodes } from "../utils/errors.js";
import {
  getActiveSequence,
  describeActiveSequence,
  soloAudioTrack,
} from "../premiere/sequence.js";
import { exportSequenceAudio } from "../audio/exporter.js";
import { transcribe } from "../transcription/client.js";
import { applyTimelineOffset } from "../transcription/offset.js";
import { segment } from "./segmenter.js";
import { buildSrt } from "../export/srt.js";

const log = createLogger("pipeline");

// Pasma procentowe etapów (suma = 100).
function band(base, span, inner) {
  return base + (Math.max(0, Math.min(100, inner)) / 100) * span;
}

/**
 * @param {object} params
 * @param {object} params.settings         bieżące ustawienia
 * @param {{audioTrackIndex:number|null, range:"full"|"inout"}} params.selection
 * @param {(p:{percent:number,status:string})=>void} params.onProgress
 * @param {AbortSignal} params.signal
 * @returns {Promise<{srtContent:string, cues:Array, offsetSec:number, language:string}>}
 */
export async function runPipeline({ settings, selection, onProgress, signal }) {
  const emit = (percent, status) => {
    if (onProgress) onProgress({ percent: Math.round(percent), status });
  };
  const checkCancel = () => {
    if (signal && signal.aborted) throw new AppError(ErrorCodes.TRANSCRIPTION_CANCELLED);
  };

  // 1) Sekwencja + walidacja (0–5%).
  emit(1, "Odczyt sekwencji…");
  const sequence = await getActiveSequence();
  const info = await describeActiveSequence();

  if (!info.audioTracks.length) throw new AppError(ErrorCodes.NO_AUDIO_TRACKS);
  if (selection.range === "inout" && !info.hasInOut) throw new AppError(ErrorCodes.EMPTY_RANGE);

  const chosen = info.audioTracks.find((t) => t.index === selection.audioTrackIndex);
  if (selection.audioTrackIndex != null && chosen && chosen.hasClips === false) {
    throw new AppError(ErrorCodes.NO_CLIPS_ON_TRACK);
  }
  checkCancel();

  // 2) Eksport audio (5–30%), z izolacją wybranej ścieżki.
  emit(5, "Eksport audio z sekwencji…");
  const restoreMutes = await soloAudioTrack(sequence, selection.audioTrackIndex);
  let audio;
  try {
    audio = await exportSequenceAudio({
      sequence,
      range: selection.range,
      presetPath: settings.audioPresetPath,
      zeroPointSec: info.zeroPointSec,
      inPointSec: info.inPointSec,
      outPointSec: info.outPointSec,
      endSec: info.endSec,
    });
  } finally {
    await restoreMutes();
  }
  emit(30, "Audio gotowe. Transkrypcja…");
  checkCancel();

  // 3) Transkrypcja STT (30–90%).
  const result = await transcribe(audio.path, {
    backendUrl: settings.backendUrl,
    language: settings.language || "pl",
    model: settings.sttModel || "large-v3",
    wordTimestamps: true,
    signal,
    onProgress: (p) => emit(band(30, 60, p.percent || 0), p.status || "Transkrypcja audio…"),
  });
  checkCancel();

  // 4) Offset timeline (90–92%).
  emit(91, "Dopasowanie czasu do sekwencji…");
  const shifted = applyTimelineOffset(result, audio.offsetSec);

  // 5) Segmentacja (92–98%).
  emit(94, "Segmentacja napisów…");
  const cues = segment(shifted.segments, {
    maxCharsPerLine: settings.maxCharsPerLine,
    maxLines: settings.maxLines,
    preferredMinChars: settings.preferredMinChars,
    preferredMaxChars: settings.preferredMaxChars,
    minDurationMs: settings.minDurationMs,
    maxDurationMs: settings.maxDurationMs,
  });
  if (!cues.length) {
    throw new AppError(ErrorCodes.TRANSCRIPTION_FAILED, {
      userMessage: "Nie wykryto mowy do utworzenia napisów.",
    });
  }

  // 6) SRT (98–100%).
  emit(98, "Generowanie SRT…");
  const srtContent = buildSrt(cues);

  emit(100, `Gotowe: ${cues.length} napisów.`);
  log.info("Pipeline zakończony", { cues: cues.length, language: shifted.language });

  return { srtContent, cues, offsetSec: audio.offsetSec, language: shifted.language };
}
