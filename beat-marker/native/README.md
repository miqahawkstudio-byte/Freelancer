# Beat Marker native / WASM engine

Two optional high-performance backends for `analyzeAudio()`. Both must return the
**exact same BeatGrid** as the pure-JS reference engine (`src/engine/analyze.js`),
so the choice between them is a benchmark decision, not an API change.

```
native/
  src/
    beatmarker_engine.cpp   C++ wrapper: decode (dr_wav/dr_mp3) + aubio tempo/beat
    beatgrid.h              shared struct <-> JSON contract
  third_party/              aubio, dr_wav.h, dr_mp3.h (vendored on build machine)
  uxpaddon/                 UXP hybrid addon glue (native -> JS bridge)
  wasm/                     emscripten build entry
  CMakeLists.txt
```

> Status: **scaffolding + wrapper contract only.** No binaries are built in the
> cloud dev environment (no MSVC/emscripten toolchain here). Build on Windows as
> below, then run the benchmark to compare against the JS baseline.

## Dependencies (vendored into `third_party/`, not committed)

- **aubio** (BSD-3) — onset, tempo, beat tracking.
- **dr_wav.h**, **dr_mp3.h** (public domain, single-header) — WAV + MP3 decode.
  No FFmpeg required.

## Contract

The engine exposes one function; input is a decoded or file path, output is JSON
matching the BeatGrid shape:

```cpp
// returns JSON: { bpm, meter, confidence, firstBeat, beats:[...], downbeats:[...] }
std::string analyze_file(const char* path, const AnalyzeOptions& opt);
```

`beats[i]` = `{ time, index, bar, beatInBar, strength, type }` with `time` in
seconds relative to the analyzed audio start — identical to the JS engine.

## Build — native `.uxpaddon` (Windows x64 first)

Requires Visual Studio Build Tools (MSVC) + CMake, and the UXP addon SDK.

```powershell
cmake -S native -B native/build -A x64
cmake --build native/build --config Release
# -> native/build/Release/beatmarker_engine.uxpaddon
```

Then load via UXP `require('./beatmarker_engine.uxpaddon')` and select it with
`setPreferredEngine('native')`. macOS build + notarization is a later step.

## Build — WASM (cross-platform single artifact)

Requires emscripten (`emcc`).

```bash
emcmake cmake -S native -B native/wasm-build
cmake --build native/wasm-build
# -> native/wasm/beatmarker_engine.wasm (+ .js loader)
```

Select with `setPreferredEngine('wasm')`.

## Benchmark (the decision)

```bash
node bench/benchmark.mjs --engine=js       # baseline (works today)
node bench/benchmark.mjs --engine=native   # after the native build
node bench/benchmark.mjs --engine=wasm     # after the wasm build
```

Compare **mean abs BPM error** and **xRealtime**. JS baseline (this machine):
mean error ~0.4 BPM, ~277x realtime on 30 s click tracks. Pick native if its
speed/accuracy margin justifies the per-platform build + macOS notarization;
otherwise WASM keeps one artifact for Windows + macOS.
