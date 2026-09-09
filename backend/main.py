"""
Polish Subtitle AI — lokalny backend STT (FastAPI).

Obsługuje dwa tryby:
  1) Plugin UXP: POST /api/transcribe_path {audio_path,...} → job_id,
     wynik jako JSON segmentów z word-level timestamps (/api/result/{id}).
  2) Standalone (web): POST /api/transcribe (multipart upload) → job_id,
     pobranie gotowego SRT (/api/download/{id}).

Audio nie opuszcza komputera — serwer działa lokalnie.
"""

import os
import uuid
import tempfile
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from srt_generator import build_srt
from stt import FasterWhisperEngine, TranscribeOptions
from stt.base import Cancelled
from postprocess import normalize_segments

app = FastAPI(title="Polish Subtitle AI — STT backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(tempfile.gettempdir()) / "psai_uploads"
OUTPUT_DIR = Path(tempfile.gettempdir()) / "psai_outputs"
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# Pojedyncza instancja silnika (leniwe ładowanie modeli w środku).
engine = FasterWhisperEngine()

# Stan zadań: {job_id: {...}}
jobs: dict[str, dict] = {}

ALLOWED_EXTENSIONS = {".mp3", ".mp4", ".wav", ".m4a", ".webm", ".ogg", ".aac", ".flac"}


class TranscribePathRequest(BaseModel):
    audio_path: str
    language: Optional[str] = "pl"
    model: str = "large-v3"
    word_timestamps: bool = True


def _run_job(job_id: str, audio_path: str, options: TranscribeOptions, cleanup: bool, build_srt_params: Optional[dict]):
    job = jobs.get(job_id)
    if job is None:
        return

    def on_progress(percent: float, status: str):
        job["progress"] = round(percent, 1)
        job["status"] = "transcribing"
        job["status_text"] = status

    def should_cancel() -> bool:
        return bool(job.get("cancel"))

    try:
        job["status"] = "transcribing"
        job["progress"] = 0.0

        result = engine.transcribe(
            audio_path, options, on_progress=on_progress, should_cancel=should_cancel
        )

        payload = result.to_dict()
        payload["segments"] = normalize_segments(payload["segments"])

        job["result"] = payload
        job["detected_language"] = payload["language"]
        job["duration"] = payload["duration"]

        # Standalone: zbuduj SRT do pobrania.
        if build_srt_params is not None:
            srt_content = build_srt(
                result.segments,
                max_words_per_line=build_srt_params.get("max_words_per_line", 7),
                max_lines_per_block=build_srt_params.get("max_lines_per_block", 2),
                max_chars_per_line=build_srt_params.get("max_chars_per_line", 42),
                max_segment_duration=build_srt_params.get("max_segment_duration", 5.0),
            )
            out_path = OUTPUT_DIR / f"{job_id}.srt"
            out_path.write_text(srt_content, encoding="utf-8")
            job["srt_path"] = str(out_path)

        job["status"] = "done"
        job["progress"] = 100.0
        job["status_text"] = "Gotowe."

    except Cancelled:
        job["status"] = "cancelled"
        job["status_text"] = "Przerwano."
    except FileNotFoundError:
        job["status"] = "error"
        job["error"] = "audio_not_found"
        job["status_text"] = "Nie znaleziono pliku audio."
    except Exception as e:  # nie ujawniamy stack trace klientowi jako komunikatu głównego
        job["status"] = "error"
        job["error"] = type(e).__name__
        job["status_text"] = "Błąd transkrypcji."
    finally:
        if cleanup:
            try:
                os.remove(audio_path)
            except OSError:
                pass


@app.get("/health")
async def health():
    return {"status": "ok", "engine": engine.describe()}


@app.get("/api/models")
async def models():
    return {"models": engine.available_models(), "engine": engine.describe(), "default": "large-v3"}


@app.post("/api/transcribe_path")
async def transcribe_path(req: TranscribePathRequest, background_tasks: BackgroundTasks):
    """Tryb pluginu: backend czyta plik bezpośrednio z dysku (lokalnie)."""
    p = Path(req.audio_path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="audio_not_found")
    if p.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"unsupported_format: {p.suffix}")

    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "queued", "progress": 0.0, "cancel": False}

    options = TranscribeOptions(
        language=req.language,
        model=req.model,
        word_timestamps=req.word_timestamps,
    )
    # Plugin sam sprząta swój plik audio — nie usuwamy go tutaj.
    background_tasks.add_task(_run_job, job_id, str(p), options, False, None)
    return {"job_id": job_id}


@app.post("/api/transcribe")
async def transcribe(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: str = Form("pl"),
    model_size: str = Form("large-v3"),
    max_words_per_line: int = Form(7),
    max_lines_per_block: int = Form(2),
    max_chars_per_line: int = Form(42),
    max_segment_duration: float = Form(5.0),
):
    """Tryb standalone (web): upload pliku + budowa SRT do pobrania."""
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"unsupported_format: {suffix}")

    job_id = str(uuid.uuid4())
    upload_path = UPLOAD_DIR / f"{job_id}{suffix}"
    async with aiofiles.open(upload_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            await f.write(chunk)

    jobs[job_id] = {"status": "queued", "progress": 0.0, "cancel": False}

    options = TranscribeOptions(language=language, model=model_size, word_timestamps=True)
    build_params = {
        "max_words_per_line": max_words_per_line,
        "max_lines_per_block": max_lines_per_block,
        "max_chars_per_line": max_chars_per_line,
        "max_segment_duration": max_segment_duration,
    }
    background_tasks.add_task(_run_job, job_id, str(upload_path), options, True, build_params)
    return {"job_id": job_id}


@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job_not_found")
    return {
        "status": job.get("status"),
        "progress": job.get("progress", 0.0),
        "status_text": job.get("status_text", ""),
        "detected_language": job.get("detected_language"),
        "duration": job.get("duration"),
        "error": job.get("error"),
    }


@app.get("/api/result/{job_id}")
async def get_result(job_id: str):
    """Tryb pluginu: zwraca wynik JSON (segmenty + word timestamps)."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job_not_found")
    if job.get("status") != "done":
        raise HTTPException(status_code=409, detail=f"not_ready: {job.get('status')}")
    return JSONResponse(content=job["result"])


@app.post("/api/cancel/{job_id}")
async def cancel(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job_not_found")
    job["cancel"] = True
    return {"ok": True}


@app.get("/api/download/{job_id}")
async def download_srt(job_id: str, filename: Optional[str] = None):
    """Tryb standalone: pobranie gotowego SRT."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job_not_found")
    if job.get("status") != "done" or "srt_path" not in job:
        raise HTTPException(status_code=409, detail="not_ready")

    srt_path = Path(job["srt_path"])
    if not srt_path.exists():
        raise HTTPException(status_code=404, detail="srt_not_found")

    dl_name = filename or f"napisy_{job_id[:8]}.srt"
    return FileResponse(
        path=str(srt_path),
        media_type="text/plain; charset=utf-8",
        filename=dl_name,
        headers={"Content-Disposition": f'attachment; filename="{dl_name}"'},
    )
