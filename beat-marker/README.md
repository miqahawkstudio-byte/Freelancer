# Beat Marker — Adobe Premiere Pro UXP plugin

Automatic music beat/BPM detection that creates **real Premiere Pro timeline
markers** for editing to the beat. Standalone project — unrelated to any
subtitles/transcription tooling in this repository.

> Status: **Krok 0 + Krok 1** (panel skeleton + read-only Premiere adapter +
> tested core logic). This is real, in-progress scaffolding, not the finished
> plugin. See the roadmap below.

## Why UXP (and not CEP/ExtendScript)

Target is the modern **UXP API** for Premiere Pro (25.x+), which is
Promise-based and uses an Action + `executeTransaction` model. The legacy
ExtendScript API (`Marker.setColorByIndex`, synchronous calls) is intentionally
not used.

## Verified API foundation (from official UXP reference)

- Sequence: `getActiveSequence`, `getTimebase`, `getZeroPoint`, `getInPoint`,
  `getOutPoint`, `getEndTime`, `getAudioTrackCount`, `getAudioTrack(i)`.
- Clips: `AudioTrack.getTrackItems(type, includeEmpty)` →
  `AudioClipTrackItem` with `getStartTime/getEndTime/getInPoint/getOutPoint`
  (all `TickTime`) and `getProjectItem()`.
- Markers: `Markers.getMarkers(seq)` → `createAddMarkerAction(name, type,
  start, duration, comments)` / `createRemoveMarkerAction(marker)` /
  `getMarkers()`, executed inside `project.executeTransaction(cb, label)`.
- Time: `TickTime` (254016000000 ticks/second — exact frame math).

### Known API limits (honest constraints)

- **No PCM access.** UXP exposes no raw audio samples. Timeline audio must be
  rendered to a temporary WAV via `app.encoder` before analysis.
- **Encoder renders a mix, not a single track.** For per-track analysis we
  render per clip (`encodeProjectItem`) and reconstruct timeline positions.
- **Marker color is unconfirmed in UXP.** V1 uses type/label; color is a V1.1
  item pending live verification.

Every spot that still needs confirmation inside a running Premiere is marked in
code with `// VERIFY-IN-PPRO`.

## Architecture

```
UXP Panel (UI)  →  Premiere Adapter (Sequence/Tracks/Clips/Markers/Timecode)
                →  Audio Engine (decoder + DSP, native .uxpaddon or WASM)
                →  BeatGrid (pure)  →  Timecode mapping  →  real Markers
```

The DSP engine and the UI never touch each other: the engine consumes/produces a
pure `BeatGrid`, and only the adapter layer knows the Premiere API.

## Project layout

```
beat-marker/
  manifest.json            UXP manifest (panel, Premiere 25.0+)
  index.html               panel UI (mockup layout)
  src/
    ui/                    panel.js, styles.css
    premiere/              env, Sequence, Tracks, Clips, Markers, markerTag, Timecode
    beatGrid/              BeatGrid, markerModes, bpm  (pure, engine-independent)
    utils/                 Errors, Logger
  test/                    zero-dependency unit tests
```

## Development

Requires Node 18+ for tests (no npm dependencies).

```bash
cd beat-marker
npm test          # runs the pure-logic unit suite (timecode, grid, modes, bpm, tags)
```

### Loading in Premiere Pro (Windows-first)

1. Install the Adobe **UXP Developer Tool (UDT)**.
2. In UDT: *Add Plugin* → select `beat-marker/manifest.json`.
3. Ensure Premiere Pro **25.x+** is running, then *Load* the plugin.
4. Open the panel from Premiere's Window menu.

macOS support is planned; the native engine build/notarization for macOS is a
later step (Windows x64 is the first target).

## Roadmap

- **V1 (in progress):** UXP panel, source selection (timeline + WAV/MP3), audio
  analysis (BPM, beats, downbeats), BeatGrid, real markers, First Beat Offset,
  Manual BPM, Delete Generated Markers, progress + cancel, error handling.
- **V1.1:** strong beats UI, marker colors (if API confirmed), waveform, cache,
  better confidence.
- **V2:** phrase detection, drops, transitions, energy analysis, Cut on Beat,
  Snap to Beat.

### Implemented so far

- ✅ Krok 0: panel skeleton + dark UI matching the approved mockup.
- ✅ Krok 1: read-only sequence/track/clip adapters (documented UXP surface).
- ✅ Timecode core (ticks/frames/DF/NDF, non-zero sequence start) — **tested**.
- ✅ Pure BeatGrid, marker-mode selection, BPM octave correction — **tested**.
- ✅ Safe "delete only our markers" tagging — **tested**.
- ✅ Krok 3: grid → timeline placement mapping + full marker create/delete
  wiring. **Manual BPM path works end-to-end today** (build grid → exact-frame
  markers) with no DSP engine required — **placement tested**.
- ✅ Krok 4: **working pure-JS DSP engine** behind `analyzeAudio()` —
  spectral-flux onset → autocorrelation tempo (parabolic-interpolated) →
  phase-locked beats → meter/downbeat; pure-JS WAV decoder; drift-free BPM
  octave correction. **Tested** against click tracks at 90/100/120/128/140/
  160/174 BPM (mean error ~0.4 BPM, ~277× realtime). Native aubio `.uxpaddon`
  + WASM backends are scaffolded behind the same API (`native/`), chosen by the
  benchmark harness (`npm run bench`).
- ✅ Krok 5: audio extraction + source wiring. **Audio File** (WAV) works
  end-to-end: pick → decode → analyze → markers. **Timeline** rendering via the
  encoder (per-clip or whole-mix) is wired against the documented API
  (`AudioExtractor`, `VERIFY-IN-PPRO` on encoder/preset details) and feeds a pure,
  **tested** multi-clip assembler that preserves timeline positions and keeps
  **gaps silent** (no phantom beats between clips). Progress + Cancel plumbed.
- ✅ Krok 6/7: **Settings** (persisted locally: PCM-WAV preset path, cache
  on/off, keep-temp, dev logging, plus defaults for sensitivity / marker mode /
  meter / first-beat offset), **analysis cache** (content fingerprint → BeatGrid,
  never stores audio; a repeat analysis is an instant cache hit), and a dev
  logger toggle — all **tested** (settings merge/validation, fingerprint
  stability, cache hit/miss + LRU).
- ✅ Beat-grid **export** to JSON/CSV (with absolute timeline timecodes) —
  pure + **tested** — plus an EXPORT BEAT GRID button.
- ✅ **Waveform** (V1.1): Canvas render of the analyzed audio with beats /
  strong beats / downbeats overlaid; peak computation is pure + **tested**.
- ✅ **`TESTING-IN-PREMIERE.md`** — a step-by-step live-verification checklist
  mapping every `VERIFY-IN-PPRO` spot to a concrete test.
- ⏳ Remaining for a full timeline run in Premiere: configure a PCM-WAV `.epr`
  preset in Settings, and confirm the `VERIFY-IN-PPRO` encoder/marker calls on a
  live Premiere 25.x (see `TESTING-IN-PREMIERE.md`). MP3 + native/WASM speed
  await their build.

## Engine benchmark

```bash
npm run bench                       # JS baseline (works today)
node bench/benchmark.mjs --engine=native   # after building native/ (Windows)
node bench/benchmark.mjs --engine=wasm      # after building the wasm backend
```

All three backends return the identical BeatGrid, so the native-vs-WASM choice
is a measurement, not an API change. See `native/README.md`.

### Try it now (Manual BPM, in Premiere)

1. Load the panel (see above) with a sequence open.
2. DETECTION → BPM → **Manual**, type e.g. `128`, pick a meter.
3. **BUILD GRID** → RESULT fills in.
4. Pick a marker mode (Every Beat / Downbeats / …), optional First Beat Offset.
5. **CREATE MARKERS** → real markers appear on the timeline (one Undo removes
   them all). **DELETE GENERATED MARKERS** removes only Beat Marker's markers.
