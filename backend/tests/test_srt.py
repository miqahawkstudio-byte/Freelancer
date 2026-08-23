"""Testy jednostkowe backendu — format SRT i polskie znaki (tryb standalone)."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from srt_generator import format_timestamp, split_text_into_lines  # noqa: E402


class TestSrt(unittest.TestCase):
    def test_format_timestamp(self):
        self.assertEqual(format_timestamp(0), "00:00:00,000")
        self.assertEqual(format_timestamp(2.12), "00:00:02,120")
        self.assertEqual(format_timestamp(3722.12), "01:02:02,120")

    def test_split_lines_no_word_break(self):
        lines = split_text_into_lines("Zażółć gęślą jaźń dzisiaj rano", max_words_per_line=3, max_chars_per_line=42)
        # Żadne słowo nie zostaje rozbite.
        joined = " ".join(lines).split()
        self.assertEqual(joined, "Zażółć gęślą jaźń dzisiaj rano".split())

    def test_polish_chars_preserved(self):
        lines = split_text_into_lines("ąćęłńóśźż", max_words_per_line=7, max_chars_per_line=42)
        self.assertIn("ąćęłńóśźż", lines)


if __name__ == "__main__":
    unittest.main()
