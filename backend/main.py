import os
import uuid
import asyncio
import tempfile
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from srt_generator import build_srt

app = FastAPI(title="SRT Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(tempfile.gettempdir()) / "srt_uploads"
OUTPUT_DIR = Path(tempfile.gettempdir()) / "srt_outputs"
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# Track job status
jobs: dict[str, dict] = {}


def run_transcription(
    job_id: str,
    file_path: str,
    language: str,
    max_words_per_line: int,
    max_lines_per_block: int,
    max_chars_per_line: int,
    max_segment_duration: float,
    model_size: str,
):
    try:
        jobs[job_id]["status"] = "transcribing"

        from faster_whisper import WhisperModel

        model = WhisperModel(model_size, device="cpu", compute_type="int8")

        lang = None if language == "auto" else language
        segments, info = model.transcribe(
            file_path,
            language=lang,
            beam_size=5,
            word_timestamps=False,
        )

        jobs[job_id]["status"] = "generating"
        jobs[job_id]["detected_language"] = info.language

        srt_content = build_srt(
            list(segments),
            max_words_per_line=max_words_per_line,
            max_lines_per_block=max_lines_per_block,
            max_chars_per_line=max_chars_per_line,
            max_segment_duration=max_segment_duration,
        )

        output_path = OUTPUT_DIR / f"{job_id}.srt"
        output_path.write_text(srt_content, encoding="utf-8")

        jobs[job_id]["status"] = "done"
        jobs[job_id]["srt_path"] = str(output_path)
        jobs[job_id]["detected_language"] = info.language
        jobs[job_id]["duration"] = info.duration

    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)
    finally:
        try:
            os.remove(file_path)
        except OSError:
            pass


@app.post("/api/transcribe")
async def transcribe(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: str = Form("auto"),
    max_words_per_line: int = Form(7),
    max_lines_per_block: int = Form(2),
    max_chars_per_line: int = Form(42),
    max_segment_duration: float = Form(5.0),
    model_size: str = Form("small"),
):
    allowed_extensions = {".mp3", ".mp4", ".wav", ".m4a", ".webm", ".ogg"}
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")

    job_id = str(uuid.uuid4())
    upload_path = UPLOAD_DIR / f"{job_id}{suffix}"

    async with aiofiles.open(upload_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            await f.write(chunk)

    jobs[job_id] = {"status": "queued"}

    background_tasks.add_task(
        run_transcription,
        job_id=job_id,
        file_path=str(upload_path),
        language=language,
        max_words_per_line=max_words_per_line,
        max_lines_per_block=max_lines_per_block,
        max_chars_per_line=max_chars_per_line,
        max_segment_duration=max_segment_duration,
        model_size=model_size,
    )

    return {"job_id": job_id}


@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/api/download/{job_id}")
async def download_srt(job_id: str, filename: Optional[str] = None):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "done":
        raise HTTPException(status_code=400, detail="Job not finished yet")

    srt_path = Path(job["srt_path"])
    if not srt_path.exists():
        raise HTTPException(status_code=404, detail="SRT file not found")

    dl_name = filename if filename else f"subtitles_{job_id[:8]}.srt"
    return FileResponse(
        path=str(srt_path),
        media_type="text/plain; charset=utf-8",
        filename=dl_name,
        headers={"Content-Disposition": f'attachment; filename="{dl_name}"'},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
