"""
Silnik STT oparty o faster-whisper (CTranslate2).

Domyślny model: large-v3 (najlepsza jakość PL + word-level timestamps).
Automatyczna detekcja urządzenia: CUDA (float16) → CPU (int8).

Model jest ładowany leniwie i cache'owany per (model, device, compute_type),
aby uniknąć wielokrotnego wczytywania.
"""

from __future__ import annotations

import time
from typing import Callable, Dict, List, Optional, Tuple

from .base import (
    TranscriptionEngine,
    TranscribeOptions,
    TranscriptionResult,
    Segment,
    Word,
    Cancelled,
)

AVAILABLE_MODELS = ["tiny", "base", "small", "medium", "large-v3"]


def _pick_device() -> Tuple[str, str]:
    """Zwraca (device, compute_type) — CUDA jeśli dostępne, inaczej CPU."""
    try:
        import torch  # opcjonalne; jeśli brak, zakładamy CPU

        if torch.cuda.is_available():
            return "cuda", "float16"
    except Exception:
        pass
    return "cpu", "int8"


class FasterWhisperEngine(TranscriptionEngine):
    def __init__(self, device: Optional[str] = None, compute_type: Optional[str] = None):
        auto_device, auto_compute = _pick_device()
        self.device = device or auto_device
        self.compute_type = compute_type or auto_compute
        self._cache: Dict[str, object] = {}

    def available_models(self) -> List[str]:
        return list(AVAILABLE_MODELS)

    def describe(self) -> dict:
        return {
            "engine": "faster-whisper",
            "device": self.device,
            "compute_type": self.compute_type,
            "models": self.available_models(),
        }

    def _get_model(self, model_size: str):
        key = f"{model_size}:{self.device}:{self.compute_type}"
        if key not in self._cache:
            from faster_whisper import WhisperModel

            self._cache[key] = WhisperModel(
                model_size, device=self.device, compute_type=self.compute_type
            )
        return self._cache[key]

    def transcribe(
        self,
        audio_path: str,
        options: TranscribeOptions,
        on_progress: Optional[Callable[[float, str], None]] = None,
        should_cancel: Optional[Callable[[], bool]] = None,
    ) -> TranscriptionResult:
        model = self._get_model(options.model)

        language = None if (options.language in (None, "", "auto")) else options.language

        if on_progress:
            on_progress(2.0, "Ładowanie modelu / analiza audio…")

        segments_iter, info = model.transcribe(
            audio_path,
            language=language,
            beam_size=options.beam_size,
            word_timestamps=options.word_timestamps,
            vad_filter=options.vad_filter,
        )

        total = float(getattr(info, "duration", 0.0)) or 0.0
        detected_lang = getattr(info, "language", options.language or "pl")

        out_segments: List[Segment] = []
        last_emit = 0.0

        for seg in segments_iter:
            if should_cancel and should_cancel():
                raise Cancelled()

            words: List[Word] = []
            if options.word_timestamps and getattr(seg, "words", None):
                for w in seg.words:
                    # faster-whisper: w.start, w.end, w.word
                    if w.start is None or w.end is None:
                        continue
                    words.append(Word(start=float(w.start), end=float(w.end), word=w.word))

            text = (seg.text or "").strip()
            out_segments.append(
                Segment(start=float(seg.start), end=float(seg.end), text=text, words=words)
            )

            # Postęp na podstawie pozycji w czasie audio.
            if on_progress and total > 0:
                pct = max(0.0, min(99.0, (float(seg.end) / total) * 100.0))
                now = time.time()
                if pct - last_emit >= 1.0:
                    last_emit = pct
                    on_progress(pct, "Transkrypcja audio…")

        if on_progress:
            on_progress(100.0, "Zakończono transkrypcję.")

        return TranscriptionResult(
            language=detected_lang,
            duration=total,
            segments=out_segments,
        )
