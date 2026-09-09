"""Warstwa STT — abstrakcja silnika transkrypcji (wymienialna)."""

from .base import TranscriptionEngine, TranscribeOptions, TranscriptionResult, Segment, Word
from .faster_whisper_engine import FasterWhisperEngine

__all__ = [
    "TranscriptionEngine",
    "TranscribeOptions",
    "TranscriptionResult",
    "Segment",
    "Word",
    "FasterWhisperEngine",
]
