"""Post-processing transkrypcji (normalizacja, interpunkcja, dedup).

Pełny algorytm powstaje w Etapie 7. Tutaj bezpieczne operacje niezmieniające
treści wypowiedzi (normalizacja białych znaków)."""

from .polish import normalize_text, normalize_segments

__all__ = ["normalize_text", "normalize_segments"]
