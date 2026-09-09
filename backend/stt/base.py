"""
Kontrakt silnika STT — odseparowany od konkretnej implementacji.

Reszta backendu zależy tylko od tego interfejsu, dzięki czemu silnik
(faster-whisper / whisper.cpp / chmura) da się podmienić bez zmian w API.

Struktura wyniku jest zgodna z kontraktem front-endu (uxp-plugin/src/transcription/engine.js):

    {
      "language": "pl",
      "segments": [
        {"start": 2.12, "end": 4.54, "text": "…",
         "words": [{"start": 2.12, "end": 2.40, "word": "To"}, ...]}
      ]
    }
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import Callable, List, Optional


@dataclass
class Word:
    start: float
    end: float
    word: str


@dataclass
class Segment:
    start: float
    end: float
    text: str
    words: List[Word] = field(default_factory=list)


@dataclass
class TranscriptionResult:
    language: str
    duration: float
    segments: List[Segment] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "language": self.language,
            "duration": self.duration,
            "segments": [
                {
                    "start": s.start,
                    "end": s.end,
                    "text": s.text,
                    "words": [asdict(w) for w in s.words],
                }
                for s in self.segments
            ],
        }


@dataclass
class TranscribeOptions:
    language: Optional[str] = "pl"        # None = autodetekcja
    model: str = "large-v3"
    word_timestamps: bool = True
    beam_size: int = 5
    vad_filter: bool = True               # filtr ciszy (lepsze granice segmentów)


class Cancelled(Exception):
    """Podnoszone, gdy transkrypcja zostanie przerwana przez użytkownika."""


class TranscriptionEngine(ABC):
    """Interfejs silnika STT."""

    @abstractmethod
    def available_models(self) -> List[str]:
        ...

    @abstractmethod
    def describe(self) -> dict:
        """Zwraca metadane silnika (nazwa, device, compute_type)."""
        ...

    @abstractmethod
    def transcribe(
        self,
        audio_path: str,
        options: TranscribeOptions,
        on_progress: Optional[Callable[[float, str], None]] = None,
        should_cancel: Optional[Callable[[], bool]] = None,
    ) -> TranscriptionResult:
        """
        Transkrybuje plik audio. Może okresowo wywoływać on_progress(percent, status)
        oraz sprawdzać should_cancel() i podnosić Cancelled.
        """
        ...
