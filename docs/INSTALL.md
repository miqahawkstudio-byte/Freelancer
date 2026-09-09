# Polish Subtitle AI — instalacja i uruchomienie

Kompletny przewodnik: backend STT (Whisper) + plugin UXP w Adobe Premiere Pro.

Architektura: [`ARCHITECTURE.md`](./ARCHITECTURE.md) · Preset audio: [`AUDIO_PRESET.md`](./AUDIO_PRESET.md)

---

## 1. Wymagania

- **Adobe Premiere Pro 25.0+** (obsługa UXP)
- **Adobe UXP Developer Tool (UDT)** — do wczytania pluginu w trybie dev
- **Python 3.10+** oraz **ffmpeg** (backend Whisper)
- **Node.js 18+** (build pluginu)
- (opcjonalnie) **GPU NVIDIA + CUDA** — znacząco przyspiesza transkrypcję

---

## 2. Backend STT (lokalny — audio nie opuszcza komputera)

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS:    source .venv/bin/activate
pip install -r requirements.txt

# ffmpeg:
#   Windows:  winget install Gyan.FFmpeg    (lub choco install ffmpeg)
#   macOS:    brew install ffmpeg

uvicorn main:app --host 127.0.0.1 --port 8000
```

Sprawdzenie: otwórz http://127.0.0.1:8000/health — powinno zwrócić `{"status":"ok", "engine":{...}}`.

- Domyślny model: **large-v3** (najlepsza jakość PL). Pierwsze uruchomienie pobiera
  wagi modelu (jednorazowo). Na słabszym sprzęcie ustaw w pluginie model `medium`.
- Urządzenie wykrywane automatycznie: CUDA (float16) → CPU (int8).

### Docker (alternatywa)

```bash
docker-compose up --build   # backend na :8000, tryb standalone (web) na :5173
```

---

## 3. Plugin UXP

### 3a. Build

> Repozytorium zawiera już **gotowy bundel** `uxp-plugin/dist/index.js`, więc
> jeśli nie zmieniasz kodu, ten krok możesz **pominąć** i przejść do 3b.
> Budowanie potrzebne jest tylko po modyfikacji źródeł w `src/`.

```bash
cd uxp-plugin
npm install
npm run build        # dev (sourcemap)
# lub
npm run build:prod   # produkcyjny (minifikacja)
```

### 3b. Wczytanie w Premiere (tryb developerski)

1. Uruchom **UXP Developer Tool**.
2. **Add Plugin** → wskaż `uxp-plugin/manifest.json`.
3. **Load** — panel pojawi się w Premiere: `Window → Extensions → Polish Subtitle AI`.

### 3c. Paczka do dystrybucji

```bash
npm run package
```

Tworzy `uxp-plugin/build/plugin/` (samowystarczalny folder) oraz
`build/polish-subtitle-ai.zip`. Folder można wczytać w UDT (Add Plugin →
`build/plugin/manifest.json`), a zip zmienić na `.ccx` do instalacji.

> Dystrybucja `.ccx` do instalacji „jednym kliknięciem" wymaga podpisania paczki
> narzędziem `UPIA`/`uxp` firmy Adobe. Do pracy i testów wystarcza UDT.

---

## 4. Konfiguracja w pluginie (jednorazowo)

Rozwiń **Ustawienia napisów** i ustaw:

- **Preset eksportu audio (.epr)** — ścieżka do presetu audio-only WAV
  (instrukcja utworzenia: [`AUDIO_PRESET.md`](./AUDIO_PRESET.md)). **Wymagane.**
- **Adres backendu STT** — domyślnie `http://127.0.0.1:8000`.
- Model, min/max czas napisu, maks. znaków/linia, maks. linii, interpunkcja,
  podział zdań, usuwanie powtórzeń — wg potrzeb. Ustawienia zapisują się lokalnie.

---

## 5. Workflow (end-to-end)

1. Otwórz sekwencję w Premiere; (opcjonalnie) ustaw punkty **In/Out**.
2. W panelu: wybierz **ścieżkę audio** (np. A1) i **zakres** (cała / In-Out).
3. Kliknij **GENERUJ NAPISY**. Pasek postępu pokaże etapy: eksport audio →
   transkrypcja → segmentacja → SRT. W razie potrzeby użyj **Anuluj**.
4. Po zakończeniu:
   - **EKSPORTUJ SRT** — zapis pliku (folder z ustawień lub „Zapisz jako").
   - **UTWÓRZ NAPISY W PREMIERE** — import SRT do projektu jako element napisów
     (umieszczenie na ścieżce napisów sekwencji jest ręczne — ograniczenie UXP).
   - **OTWÓRZ FOLDER** — pokaż zapisany plik.

---

## 6. Rozwiązywanie problemów

| Objaw | Przyczyna / rozwiązanie |
|---|---|
| „Brak połączenia z backendem" | Uruchom backend (`uvicorn ...`); sprawdź adres w ustawieniach. |
| „Nie wskazano presetu eksportu audio" | Ustaw ścieżkę `.epr` (audio-only WAV) — patrz AUDIO_PRESET.md. |
| „Sekwencja nie zawiera ścieżek audio" | Otwórz sekwencję z audio; użyj **Odśwież**. |
| Transkrypcja bardzo wolna | Użyj GPU (CUDA) lub mniejszego modelu (`medium`). |
| Napisy nie na osi czasu | UXP nie tworzy ścieżki napisów — przeciągnij zaimportowany element na sekwencję. |

---

## 7. Testy

```bash
# Plugin
cd uxp-plugin && npm test

# Backend
cd backend && python -m unittest discover -s tests -p 'test_*.py'
```
