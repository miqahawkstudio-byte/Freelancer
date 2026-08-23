# Testing Beat Marker in Premiere Pro (Windows)

This is the live-verification checklist. The pure logic (timecode, DSP, grid,
markers, settings, cache, export) is unit-tested in Node (`npm test`, 74 passing).
What can only be confirmed inside a running Premiere are the `VERIFY-IN-PPRO`
spots — the UXP host calls. Work through these in order; each maps to code.

## 0. Load the plugin

1. Install Adobe **UXP Developer Tool (UDT)** and Premiere Pro **25.x+**.
2. UDT → *Add Plugin* → select `beat-marker/manifest.json` → *Load*.
3. Open the panel from Premiere's **Window** menu. It should render the dark UI.
   - If it fails to load, check `manifest.json` (`host.minVersion`, permissions).

## 1. Read the timeline  (`src/premiere/Sequence.js`, `Tracks.js`, `Clips.js`)

Open a sequence with at least one audio track, then confirm the panel status
line shows the right fps and track count.

- [ ] Sequence name + fps + track count appear. → `readSequenceInfo()`
- [ ] Audio Track dropdown lists A1, A2, … → `listAudioTracks()`
- [ ] **FPS / drop-frame**: verify `getTimebase()` value and how to read the
      drop-frame flag (currently defaulted to false). → `Sequence.js` `dropFrame`
- [ ] **Non-zero start**: set the sequence start to `01:00:00:00` and confirm
      `getZeroPoint()` reflects it (First Beat timecode should be in the 01:00:xx
      range after building a grid).

## 2. Manual BPM → markers  (no engine needed — do this first)

1. DETECTION → BPM → **Manual**, type `120`, meter `4/4`.
2. **BUILD GRID** → RESULT fills in.
3. Marker mode **Downbeats**, then **CREATE MARKERS**.

- [ ] Real markers appear on the timeline ruler. → `Markers.createMarkers()`,
      `Markers.createAddMarkerAction`, `Project.executeTransaction`
- [ ] **One Undo** removes all of them at once (single transaction).
- [ ] Marker labels read like `BAR 1`, `BAR 2`. → `markerTag.buildLabel`
- [ ] Verify `CompoundAction.addAction` is the correct method name on this build.
- [ ] Marker **color**: check whether the UXP marker API exposes a color setter.
      If yes, we wire it (V1.1); if not, confirmed not available.

## 3. Delete only our markers  (`Markers.deleteGeneratedMarkers`)

1. Add a manual marker of your own (M) with a note.
2. **DELETE GENERATED MARKERS**.

- [ ] Beat Marker markers are removed; **your marker stays**. → tag `[BEAT-MARKER]`
      in `comments` via `markerTag.isOurs`.
- [ ] Confirm marker `comments` is readable back (property vs `getComments()`).

## 4. Audio File source (WAV)  (`FileSource.js`, engine)

1. SOURCE → **Audio File** → **Choose File** → pick a WAV.
2. It analyzes and fills RESULT; then CREATE MARKERS.

- [ ] File picker returns bytes. → `pickAudioFile()` (`getFileForOpening`, `read`)
- [ ] Detected BPM is sane for a track you know.
- [ ] Re-analyzing the same file shows **"(cached)"**. → `Analyzer`
- [ ] MP3 shows the clear "native/WASM engine needed" message (until built).

## 5. Timeline analysis  (`AudioExtractor.js`) — needs a PCM-WAV preset

1. SETTINGS → set **PCM WAV preset (.epr)** path (export a "Waveform Audio" PCM
   preset from Premiere's export dialog once, note its path).
2. SOURCE → **Premiere Timeline**, pick the music track, Timeline audio =
   **Selected track (per clip)**, then **ANALYZE**.

- [ ] Render produces a temp WAV. → `encodeProjectItem(...)` signature +
      work-area arg + reading the output bytes back.
- [ ] Multiple clips on the track are handled; **silence between clips gets no
      markers**. → `timelineAssemble` gap gating.
- [ ] Switch to **Whole sequence mix** and confirm `encodeSequence(...)`.
- [ ] Temp files are cleaned up unless **Keep temporary audio** is checked.
- [ ] Confirm the temp folder path (`getDataFolder()` + `beat-marker-cache`).

## 6. First Beat Offset & Manual override

- [ ] Set **Offset (ms)** and CREATE MARKERS → all markers shift by that amount
      (1 frame = 1000/fps ms). → `placement.computePlacements` `extraOffsetSeconds`
- [ ] Manual BPM overrides a mis-detected tempo and regenerates the grid.

## 7. Progress / Cancel / errors

- [ ] Long analysis shows the progress bar; **CANCEL** stops it, cleans temp
      files, creates no partial markers.
- [ ] Trigger error cases (no sequence, no track, missing preset, corrupt WAV):
      the status line shows a short message, never a stack trace.

## 8. Export beat grid  (`exportGrid.js`, `FileSource.saveTextFile`)

- [ ] EXPORT BEAT GRID (JSON/CSV) saves a file; timecodes match the markers.
      → `getFileForSaving` + `write`.

---

### When a `VERIFY-IN-PPRO` call is wrong

Each is isolated in the `premiere/` adapter. If a signature differs on your
build, note the actual one and it's a one-line fix in that adapter — the engine,
timecode math, and UI don't change. Grep the codebase:

```bash
grep -rn "VERIFY-IN-PPRO" src/
```
