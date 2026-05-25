# SRT Generator – napisy AI dla Premiere Pro i DaVinci Resolve

Aplikacja webowa generująca napisy w formacie `.srt` z plików audio i wideo (MP3, MP4 i inne) przy użyciu modelu AI **Whisper** (faster-whisper).

## Funkcje

- Obsługa plików **MP3, MP4, WAV, M4A, OGG, WEBM**
- Transkrypcja **wielojęzyczna** (polski, angielski, niemiecki i 90+ języków)
- Automatyczne wykrywanie języka
- Konfiguracja napisów przed generowaniem:
  - Liczba słów w jednej linii
  - Liczba linii na jeden napis
  - Maks. liczba znaków w linii
  - Maks. czas trwania napisu
- Presety: YouTube, Instagram Reels, Film, Podcast
- Wybór modelu Whisper (Tiny → Large-v3)
- Pobieranie gotowego pliku `.srt` kompatybilnego z Premiere Pro i DaVinci Resolve

## Wymagania

- Python 3.10+
- Node.js 18+
- **ffmpeg** zainstalowany w systemie (`apt install ffmpeg` / `brew install ffmpeg`)

## Uruchomienie (lokalne)

```bash
chmod +x start.sh
./start.sh
```

Otwórz [http://localhost:5173](http://localhost:5173) w przeglądarce.

## Uruchomienie z Docker

```bash
docker-compose up --build
```

## Struktura projektu

```
├── backend/
│   ├── main.py           # FastAPI API
│   ├── srt_generator.py  # Formatowanie napisów SRT
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── DropZone.tsx
│       │   ├── SettingsPanel.tsx
│       │   └── StatusCard.tsx
│       └── types.ts
└── start.sh
```

## Jak działa SRT

Format SRT wygenerowany przez tę aplikację jest w pełni kompatybilny z Premiere Pro i DaVinci Resolve. Wystarczy zaimportować plik `.srt` jako napisty w obu programach.
