# Polish Subtitle AI — plugin UXP (Premiere Pro)

Panel do Adobe Premiere Pro (UXP) generujący polskie napisy z audio na timeline.
Architektura i decyzje: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## Status

Etap 2 (z 12): struktura projektu + minimalny, ładowalny panel.
Pipeline (sekwencja → audio → STT → segmentacja → SRT → napisy) jest podpinany
w kolejnych etapach. Przyciski generowania są celowo wyłączone z opisem etapu.

## Wymagania

- Adobe Premiere Pro **25.0+** (UXP)
- [Adobe UXP Developer Tool (UDT)](https://developer.adobe.com/photoshop/uxp/2022/guides/devtool/) do wczytania pluginu
- Node.js 18+ (do builda)
- Lokalny backend STT (Whisper) — patrz [`../backend`](../backend) (podłączenie w Etapie 5)

## Build

```bash
cd uxp-plugin
npm install
npm run build      # bundluje src/ → dist/index.js (esbuild)
npm run watch      # tryb developerski (rebuild przy zmianach)
```

Moduły `premierepro` i `uxp` są traktowane jako zewnętrzne (dostarcza je runtime UXP).

## Wczytanie w Premiere Pro (dev)

1. Zbuduj: `npm run build`.
2. Otwórz **UXP Developer Tool** → **Add Plugin** → wskaż `uxp-plugin/manifest.json`.
3. **Load** → panel pojawi się w Premiere: `Window → Extensions → Polish Subtitle AI`.

## Struktura

```
uxp-plugin/
  manifest.json        # UXP v5, host: premierepro, uprawnienia (localhost, FS)
  index.html           # host panelu → dist/index.js
  dist/                # bundle (generowany, w .gitignore)
  icons/               # placeholdery (do podmiany)
  src/
    main.js            # bootstrap
    ui/                # panel, style, status/progress
    config/            # domyślne ustawienia + trwały zapis
    premiere/          # dostęp do UXP DOM (sekwencja, ścieżki, timecode)
    audio/             # eksport audio (exportSequence → WAV)
    transcription/     # kontrakt silnika STT + klient backendu
    subtitles/         # segmentacja / łamanie linii / timing
    export/            # generator SRT
    utils/             # logger, błędy domenowe
```

## Uwaga o polskim STT

Wbudowany Speech-to-Text w Premiere Pro **nie obsługuje języka polskiego**,
dlatego transkrypcja opiera się na lokalnym silniku Whisper (backend), a audio
nie opuszcza komputera.
