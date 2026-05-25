from typing import List
import re


def format_timestamp(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def split_text_into_lines(text: str, max_words_per_line: int, max_chars_per_line: int) -> List[str]:
    words = text.strip().split()
    if not words:
        return []

    lines = []
    current_line = []
    current_chars = 0

    for word in words:
        word_len = len(word)
        space_needed = 1 if current_line else 0
        fits_words = len(current_line) < max_words_per_line
        fits_chars = (current_chars + space_needed + word_len) <= max_chars_per_line

        if current_line and (not fits_words or not fits_chars):
            lines.append(" ".join(current_line))
            current_line = [word]
            current_chars = word_len
        else:
            current_line.append(word)
            current_chars += space_needed + word_len

    if current_line:
        lines.append(" ".join(current_line))

    return lines


def build_srt(
    segments,
    max_words_per_line: int,
    max_lines_per_block: int,
    max_chars_per_line: int,
    max_segment_duration: float,
) -> str:
    """
    Convert Whisper segments to SRT content with custom formatting rules.
    """
    srt_blocks = []
    index = 1

    for segment in segments:
        start = segment.start
        end = segment.end
        text = segment.text.strip()

        if not text:
            continue

        # Split text into lines respecting max words and chars
        lines = split_text_into_lines(text, max_words_per_line, max_chars_per_line)

        if not lines:
            continue

        # Group lines into blocks of max_lines_per_block
        for block_start_idx in range(0, len(lines), max_lines_per_block):
            block_lines = lines[block_start_idx: block_start_idx + max_lines_per_block]
            block_text = "\n".join(block_lines)

            # Proportionally distribute time across blocks
            total_blocks = -(-len(lines) // max_lines_per_block)  # ceiling division
            block_idx = block_start_idx // max_lines_per_block
            duration = end - start
            block_duration = duration / total_blocks
            block_start = start + block_idx * block_duration
            block_end = block_start + min(block_duration, max_segment_duration)

            srt_blocks.append(
                f"{index}\n"
                f"{format_timestamp(block_start)} --> {format_timestamp(block_end)}\n"
                f"{block_text}\n"
            )
            index += 1

    return "\n".join(srt_blocks)
