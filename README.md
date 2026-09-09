# Polish Subtitle AI

Profesjonalny plugin do **Adobe Premiere Pro (UXP)** do automatycznego tworzenia
**polskich napisów** z audio na timeline, z użyciem lokalnego silnika **Whisper**
(faster-whisper). Audio nie opuszcza komputera.

> Wbudowany Speech-to-Text w Premiere Pro nie obsługuje języka polskiego —
> dlatego transkrypcję realizuje lokalny backend Whisper.

## Co potrafi

- Wybór ścieżki audio z aktywnej sekwencji i zakresu (cała / In-Out).
- Eksport audio przez oficjalne API Premiere (`EncoderManager.exportSequence`).
- Transkrypcja PL (Whisper) z **word-level timestamps**.
- Precyzyjny **timecode względem timeline** (uwzględnia In/Out, start sekwencji, FPS/timebase).
- **Inteligentna segmentacja**: końce zdań, przecinki, pauzy; max 42 znaki/linia,
  max 2 linie; bez dzielenia słów, liczb+jednostek, imion.
- Generator **SRT** (UTF-8, polskie znaki, brak nakładania).
- Import SRT do Premiere (best-effort) lub eksport pliku.
- Ciemny UI z paskiem postępu, statusem i przyciskiem Anuluj; zapisywane ustawienia.

## Struktura

```
uxp-plugin/    # plugin UXP (panel Premiere) — patrz uxp-plugin/README.md
backend/       # lokalny serwer STT (FastAPI + faster-whisper)
frontend/      # tryb standalone (web: upload pliku → SRT)
docs/          # ARCHITECTURE.md, INSTALL.md, AUDIO_PRESET.md
```

## Szybki start

Pełna instrukcja: **[docs/INSTALL.md](docs/INSTALL.md)**.

```bash
# 1) Backend STT
cd backend && pip install -r requirements.txt && uvicorn main:app --host 127.0.0.1 --port 8000

# 2) Plugin
cd uxp-plugin && npm install && npm run build
#    → wczytaj uxp-plugin/manifest.json w Adobe UXP Developer Tool
```

W pluginie ustaw preset eksportu audio (.epr, audio-only WAV) — patrz
[docs/AUDIO_PRESET.md](docs/AUDIO_PRESET.md) — i kliknij **GENERUJ NAPISY**.

## Tryb standalone (web)

Aplikacja webowa (upload pliku audio/wideo → SRT), wykorzystuje ten sam backend:

```bash
docker-compose up --build   # backend :8000, frontend :5173
```

## Architektura i decyzje techniczne

Zobacz **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — m.in. dlaczego audio
pozyskujemy przez eksport (brak dostępu do PCM w UXP), jak liczony jest offset
timecode oraz jaki jest stan Caption API w UXP.

## Testy

```bash
cd uxp-plugin && npm test                                   # 20 testów (plugin)
cd backend && python -m unittest discover -s tests -p 'test_*.py'   # backend
```

## Licencja / bezpieczeństwo

Brak kluczy API w kodzie. Rozwiązanie preferuje pracę lokalną — audio nie jest
wysyłane do chmury.
