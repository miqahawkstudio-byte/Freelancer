"""
Post-processing dla języka polskiego.

ETAP 5: bezpieczna normalizacja białych znaków (nie zmienia treści).
ETAP 7: rozbudowa o interpunkcję, usuwanie powtórzeń, korektę oczywistych
błędów — wszystko sterowane flagami i bez dopisywania treści, której nie ma
w audio.

Uwaga: zachowujemy polskie znaki (ą ć ę ł ń ó ś ź ż) — operujemy na Unicode,
nigdy nie usuwamy „nie-ASCII".
"""

from __future__ import annotations

import re
from typing import List


def normalize_text(text: str) -> str:
    """Czyści białe znaki bez zmiany treści."""
    if not text:
        return ""
    t = text.replace(" ", " ")          # twarda spacja → zwykła
    t = re.sub(r"\s+", " ", t)               # zwielokrotnione spacje
    t = re.sub(r"\s+([,.;:!?])", r"\1", t)   # spacja przed interpunkcją
    return t.strip()


def normalize_segments(segments: List[dict]) -> List[dict]:
    """Normalizuje tekst segmentów (i słów) bez zmiany timestampów."""
    for s in segments:
        s["text"] = normalize_text(s.get("text", ""))
    return segments
