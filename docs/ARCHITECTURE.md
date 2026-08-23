# Polish Subtitle AI — Architektura

> Plugin do Adobe Premiere Pro (UXP) do automatycznej generacji polskich napisów
> z audio na timeline, z wykorzystaniem lokalnego silnika Whisper.

Ten dokument jest efektem **Etapu 1** (analiza techniczna) i stanowi wspólny punkt
odniesienia dla dalszej implementacji.

---

## 1. Możliwości i ograniczenia Premiere Pro UXP (stan zweryfikowany)

Źródła: oficjalna dokumentacja Adobe (`developer.adobe.com/premiere-pro/uxp`),
changelog UXP, oraz wątki Adobe Community.

| Funkcja | Status w UXP | Wniosek dla pluginu |
|---|---|---|
| Odczyt aktywnego projektu / sekwencji | ✅ `require('premierepro')`, `app.project`, `getActiveSequence()` | Bezpośrednio w pluginie |
| Odczyt ścieżek audio (`AudioTrack`, `getAudioTrackCount`) | ✅ (nazwa, track items) | Bezpośrednio |
| In/Out point sekwencji, timebase, FPS | ✅ przez ustawienia sekwencji | Bezpośrednio (patrz §4) |
| **Bezpośredni dostęp do PCM audio** | ❌ brak API do surowych próbek | **Wymagany eksport przez Encoder** |
| Eksport/render (`Encoder.exportSequence`) | ✅ z presetem `.epr` (audio-only WAV) | Metoda pozyskania audio |
| Wbudowany Speech-to-Text (transcript API) | ⚠️ istnieje, ale **brak języka polskiego** | Nieprzydatny dla PL → własny Whisper |
| Tworzenie/edycja napisów (Caption API) | ⚠️ „under construction", odczyt częściowy | **Best-effort + fallback do importu SRT** |
| Dodawanie klipów na timeline | ❌ brak API | Nie dotyczy naszego zakresu |

### Wnioski architektoniczne

1. **Audio pozyskujemy przez oficjalny eksport** (`exportSequence` → WAV audio-only),
   nie przez (nieistniejący) odczyt PCM. Preset `.epr` audio-only dostarczamy z pluginem.
2. **Transkrypcja PL wymaga zewnętrznego silnika** (lokalny backend Whisper), bo
   Adobe STT nie wspiera polskiego.
3. **Wstawianie napisów do Premiere jest opcjonalne i best-effort.** Gwarantowany
   deliverable to poprawny plik **SRT**; import do Premiere próbujemy programowo,
   a gdy API zawiedzie — otwieramy/wskazujemy ścieżkę importu ręcznego.

   Stan API potwierdzony w oficjalnej referencji UXP (Etap 9): **brak
   `createCaptionTrack`** na `Sequence`/`Project`; caption API jest tylko do
   odczytu (`getCaptionTrack`, `getCaptionTrackCount`). Istnieje natomiast
   `Project.importFiles(...)`, więc SRT **importujemy do projektu** jako element
   napisów, ale **umieszczenie go na ścieżce napisów sekwencji pozostaje ręczne**
   (UXP nie pozwala utworzyć ścieżki napisów z kodu).

---

## 2. Architektura wysokiego poziomu

```
┌─────────────────────────────────────────┐
│  Adobe Premiere Pro                       │
│  ┌─────────────────────────────────────┐ │
│  │  Plugin UXP  (panel)                 │ │
│  │  UI ─ Premiere ─ Audio ─ Export      │ │
│  │        │            │                 │ │
│  └────────┼────────────┼─────────────────┘ │
│           │ exportSequence (WAV)            │
└───────────┼────────────┼────────────────────┘
            │ HTTP (localhost)                │ plik WAV na dysku
            ▼                                 ▼
   ┌───────────────────────────────────────────┐
   │  Lokalny backend STT  (FastAPI, osobny     │
   │  proces)                                    │
   │   faster-whisper (large-v3) → segments +    │
   │   word-level timestamps (JSON)              │
   └───────────────────────────────────────────┘
```

- **Audio nie opuszcza komputera** — backend działa lokalnie (`localhost:8000`).
- Backend jest **osobnym procesem** (uruchamiany ręcznie / skryptem; opcjonalnie
  wskazywany w ustawieniach). Plugin komunikuje się z nim po HTTP.
- Ten sam backend obsługuje **tryb standalone** (istniejący frontend web).

### Wybór technologii backendu

Python + FastAPI + `faster-whisper`. Uzasadnienie: najbogatszy ekosystem Whisper,
gotowe wsparcie CPU (int8) i GPU (CUDA), łatwa dystrybucja na Windows i macOS,
oraz reużycie kodu już obecnego w repo. Alternatywy (whisper.cpp, Rust) pozostają
możliwe dzięki abstrakcji silnika (patrz §5).

---

## 3. Struktura katalogów

```
/uxp-plugin                 # plugin UXP (front)
  manifest.json             # manifest UXP v5 (host: premierepro)
  index.html                # host panelu
  /icons
  /src
    main.js                 # bootstrap panelu
    /ui                     # widok, ustawienia, progress, status, błędy
    /premiere               # active sequence, audio tracks, in/out, timecode, captions
    /audio                  # eksport audio (exportSequence + preset .epr)
    /transcription          # klient backendu STT (adapter, wymienialny silnik)
    /subtitles              # segmentacja, łamanie linii, timing, post-processing
    /export                 # generator SRT, zapis pliku (UTF-8)
    /utils                  # logger, format czasu, walidacje, błędy domenowe
    /config                 # domyślne ustawienia + trwałe przechowywanie

/backend                    # lokalny serwer STT (Python/FastAPI) — reużyty + rozwijany
/frontend                   # tryb standalone (web) — pozostaje

/docs                       # architektura, instrukcje
```

Logika czysta (segmentacja, SRT, timecode) jest w modułach **bez zależności od UXP**,
dzięki czemu jest testowalna w Node (Etap 11).

---

## 4. Krytyczne: timecode i offset

Wyeksportowany WAV zawsze zaczyna się od `0.0 s`. Whisper zwraca czasy względem
początku pliku. Aby SRT był zgodny z timeline Premiere:

```
srt_time = whisper_time + offset
offset   = (sequence_in_point_seconds) − (sequence_zero_point_seconds)
```

Uwzględniamy:
- **In / Out point** — gdy eksportujemy tylko zakres (nie całą sekwencję),
- **zeroPoint sekwencji** — sekwencja może zaczynać się od np. `01:00:00:00`,
- **timebase / FPS** — do konwersji ticków Premiere na sekundy,
- różnicę „czas audio ↔ czas sekwencji".

Format SRT: `HH:MM:SS,mmm`. Testy graniczne w Etapie 11 (m.in. start ≠ 0).

---

## 5. Interfejs silnika STT (wymienialny)

```
transcribe(audioFile, options) -> {
  language: "pl",
  segments: [ { start: 2.12, end: 4.54, text: "...", words?: [ {start,end,word} ] } ]
}
```

- Domyślny adapter: `faster-whisper` (large-v3), word-level timestamps ON.
- Możliwość podmiany: whisper.cpp / cloud API — bez zmian w reszcie aplikacji.
- Klucze API (jeśli kiedyś cloud) — wyłącznie przez bezpieczną konfigurację, nigdy w kodzie.

---

## 6. Pipeline post-processingu

```
raw transcription → normalizacja → interpunkcja → korekta oczywistych błędów
                  → segmentacja → walidacja → SRT
```

- Nie zmieniamy treści wypowiedzi ani nie dopisujemy informacji.
- Korekta AI/LLM (jeśli dodana) jest **opcjonalna**.
- Segmentacja bierze pod uwagę: końce zdań, przecinki, pauzy (z word-timestamps),
  długość, czytelność, max znaków/linia (42), max linii (2), nie dzieli słów,
  imion/nazwisk, liczb z jednostkami, naturalnych fraz.

---

## 7. Obsługa błędów (mapowane na komunikaty użytkownika)

brak sekwencji · brak ścieżek audio · brak klipów na ścieżce · pusty zakres ·
błąd eksportu audio · brak backendu / brak połączenia · brak modelu ·
przerwanie transkrypcji · brak miejsca na dysku · błąd zapisu SRT · format niewspierany.

Użytkownik nie widzi stack trace jako komunikatu głównego — techniczne szczegóły
trafiają tylko do logów developerskich (bez pełnego audio / pełnej transkrypcji).

---

## 8. Etapy realizacji

1. ✅ Analiza + architektura (ten dokument)
2. Struktura projektu + minimalny działający plugin UXP
3. Wykrywanie aktywnej sekwencji i ścieżek audio
4. Pozyskiwanie audio (exportSequence → WAV)
5. Backend STT + Whisper (word timestamps, cancel, health/models)
6. Transkrypcja + timestampy (offset timeline)
7. Algorytm segmentacji napisów
8. Generator SRT
9. Wstawianie napisów do Premiere (best-effort)
10. UI, ustawienia, progress, obsługa błędów
11. Testy jednostkowe
12. Build produkcyjny + instrukcja instalacji
