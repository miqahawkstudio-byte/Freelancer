import json
import re
import uuid
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="CalorieVision API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VISION_PROMPT = """Jesteś precyzyjnym asystentem dietetycznym analizującym zdjęcia posiłków.

ZADANIE: Zidentyfikuj wszystkie produkty spożywcze widoczne na zdjęciu i oszacuj ich wartości odżywcze.

ZASADY:
1. Podawaj ZAKRESY (min–max) – to uczciwy szacunek, nie precyzyjny pomiar
2. Szacuj gramaturę na podstawie: rozmiaru naczynia, standardowych porcji, proporcji na zdjęciu
3. Uwzględnij sposób przygotowania (surowe/gotowane/smażone ma wpływ na kcal)
4. Confidence: 0.9+ wyraźnie widoczne i pewne, 0.7–0.9 prawdopodobne, 0.5–0.7 niepewne, <0.5 zgadywanie

PRZYPADKI SPECJALNE:
- Nieczytelne/rozmazane zdjęcie → {"success": false, "error": "Zdjęcie niewyraźne – zrób wyraźniejsze"}
- Brak jedzenia na zdjęciu → {"success": false, "error": "Nie wykryto jedzenia na zdjęciu"}
- Zamknięte opakowanie/pojemnik → podaj jako jedną pozycję z confidence 0.2 i bardzo szerokimi zakresami
- Danie mieszane (zupa, sałatka) → możesz podać całość jako jedną pozycję lub rozdzielić składniki

Odpowiedz WYŁĄCZNIE czystym JSON (zero tekstu poza JSON, zero backticks, zero markdown):
{
  "success": true,
  "items": [
    {
      "name": "Kurczak pieczony",
      "description": "Pierś z kurczaka bez skóry, pieczona w piekarniku",
      "quantity_g": {"min": 150, "max": 180},
      "kcal": {"min": 165, "max": 198},
      "protein_g": {"min": 31, "max": 37},
      "carbs_g": {"min": 0, "max": 1},
      "fat_g": {"min": 3, "max": 5},
      "confidence": 0.85
    }
  ],
  "overall_confidence": 0.8,
  "notes": "Opcjonalny komentarz o warunkach analizy",
  "error": null
}"""


class AnalyzeRequest(BaseModel):
    image_base64: str
    media_type: str = "image/jpeg"
    api_key: str
    provider: str = "claude"
    model: Optional[str] = None


@app.post("/api/analyze")
async def analyze_image(req: AnalyzeRequest):
    if not req.api_key:
        raise HTTPException(
            status_code=400,
            detail="Brak klucza API. Skonfiguruj go w Ustawieniach.",
        )

    try:
        if req.provider == "claude":
            result = _analyze_claude(req)
        elif req.provider == "openai":
            result = await _analyze_openai(req)
        else:
            raise HTTPException(status_code=400, detail=f"Nieznany provider: {req.provider}")

        return _add_ids(result)

    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        if "authentication" in msg.lower() or "401" in msg or "api_key" in msg.lower():
            raise HTTPException(status_code=401, detail="Nieprawidłowy klucz API")
        if "rate" in msg.lower() or "429" in msg:
            raise HTTPException(status_code=429, detail="Przekroczono limit API – poczekaj chwilę")
        raise HTTPException(status_code=500, detail=f"Błąd analizy: {msg}")


def _analyze_claude(req: AnalyzeRequest) -> dict:
    import anthropic

    client = anthropic.Anthropic(api_key=req.api_key)
    model = req.model or "claude-sonnet-4-6"

    message = client.messages.create(
        model=model,
        max_tokens=2048,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": req.media_type,
                            "data": req.image_base64,
                        },
                    },
                    {"type": "text", "text": VISION_PROMPT},
                ],
            }
        ],
    )

    return _parse_json(message.content[0].text)


async def _analyze_openai(req: AnalyzeRequest) -> dict:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=req.api_key)
    model = req.model or "gpt-4o"

    response = await client.chat.completions.create(
        model=model,
        max_tokens=2048,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{req.media_type};base64,{req.image_base64}"
                        },
                    },
                    {"type": "text", "text": VISION_PROMPT},
                ],
            }
        ],
    )

    return _parse_json(response.choices[0].message.content)


def _parse_json(raw: str) -> dict:
    clean = raw.strip()
    # Remove markdown code fences if the model added them despite instructions
    clean = re.sub(r"^```(?:json)?\s*", "", clean, flags=re.MULTILINE)
    clean = re.sub(r"\s*```\s*$", "", clean, flags=re.MULTILINE)
    clean = clean.strip()

    try:
        return json.loads(clean)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Model zwrócił nieprawidłowy JSON: {exc}") from exc


def _add_ids(data: dict) -> dict:
    for item in data.get("items", []):
        if "id" not in item:
            item["id"] = str(uuid.uuid4())
    return data


@app.get("/health")
def health():
    return {"status": "ok", "service": "CalorieVision API"}
