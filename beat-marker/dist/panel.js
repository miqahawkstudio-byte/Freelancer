(() => {
  // src/utils/Errors.js
  var ErrorCode = Object.freeze({
    UXP_UNAVAILABLE: "UXP_UNAVAILABLE",
    NO_PROJECT: "NO_PROJECT",
    NO_ACTIVE_SEQUENCE: "NO_ACTIVE_SEQUENCE",
    NO_AUDIO_TRACK: "NO_AUDIO_TRACK",
    NO_AUDIO_CLIPS: "NO_AUDIO_CLIPS",
    EMPTY_RANGE: "EMPTY_RANGE",
    UNSUPPORTED_FORMAT: "UNSUPPORTED_FORMAT",
    DECODE_FAILED: "DECODE_FAILED",
    EXPORT_FAILED: "EXPORT_FAILED",
    NO_DISK_SPACE: "NO_DISK_SPACE",
    ENGINE_FAILED: "ENGINE_FAILED",
    ENGINE_MISSING: "ENGINE_MISSING",
    MARKER_FAILED: "MARKER_FAILED",
    CANCELLED: "CANCELLED",
    UXP_ERROR: "UXP_ERROR"
  });
  var DEFAULT_MESSAGE = {
    [ErrorCode.UXP_UNAVAILABLE]: "Premiere Pro is required to run Beat Marker.",
    [ErrorCode.NO_PROJECT]: "Open a project first.",
    [ErrorCode.NO_ACTIVE_SEQUENCE]: "Open a sequence first.",
    [ErrorCode.NO_AUDIO_TRACK]: "The sequence has no audio track.",
    [ErrorCode.NO_AUDIO_CLIPS]: "The selected track has no audio clips.",
    [ErrorCode.EMPTY_RANGE]: "The selected range is empty.",
    [ErrorCode.UNSUPPORTED_FORMAT]: "Unsupported audio format. Use WAV or MP3.",
    [ErrorCode.DECODE_FAILED]: "Could not decode the audio file.",
    [ErrorCode.EXPORT_FAILED]: "Could not export audio from the timeline.",
    [ErrorCode.NO_DISK_SPACE]: "Not enough disk space for temporary audio.",
    [ErrorCode.ENGINE_FAILED]: "Audio analysis failed.",
    [ErrorCode.ENGINE_MISSING]: "The analysis engine is not installed.",
    [ErrorCode.MARKER_FAILED]: "Could not create markers.",
    [ErrorCode.CANCELLED]: "Analysis cancelled.",
    [ErrorCode.UXP_ERROR]: "A Premiere Pro error occurred."
  };
  var BeatMarkerError = class extends Error {
    /**
     * @param {string} code   one of ErrorCode
     * @param {string} [userMessage] short message for the UI
     * @param {*} [details]    developer context (logged, not shown)
     */
    constructor(code, userMessage, details) {
      const msg = userMessage || DEFAULT_MESSAGE[code] || "Something went wrong.";
      super(msg);
      this.name = "BeatMarkerError";
      this.code = code;
      this.userMessage = msg;
      this.details = details;
    }
  };
  function toBeatMarkerError(err, fallbackCode = ErrorCode.UXP_ERROR) {
    if (err instanceof BeatMarkerError) return err;
    const message = err && err.message ? err.message : String(err);
    return new BeatMarkerError(fallbackCode, DEFAULT_MESSAGE[fallbackCode], message);
  }

  // src/premiere/hostRequire.js
  function hostRequire(name) {
    try {
      const req = typeof globalThis !== "undefined" && typeof globalThis.require === "function" ? globalThis.require : null;
      return req ? req(name) : null;
    } catch {
      return null;
    }
  }

  // src/premiere/env.js
  var _ppro = null;
  function isUxp() {
    return hostRequire("premierepro") != null;
  }
  function ppro() {
    if (_ppro) return _ppro;
    const mod = hostRequire("premierepro");
    if (!mod) {
      throw new BeatMarkerError(
        ErrorCode.UXP_UNAVAILABLE,
        "Premiere Pro UXP API not available. Run this panel inside Premiere Pro 25.x or later."
      );
    }
    _ppro = mod;
    return _ppro;
  }
  async function getActiveProject() {
    const api = ppro();
    const project = await api.Project.getActiveProject();
    if (!project) {
      throw new BeatMarkerError(ErrorCode.NO_PROJECT, "No project is open.");
    }
    return project;
  }

  // src/premiere/Timecode.js
  var TICKS_PER_SECOND = 254016e6;
  var TICKS_PER_FRAME = Object.freeze({
    24: 10584e6,
    25: 1016064e4,
    30: 84672e5,
    50: 508032e4,
    60: 42336e5,
    // 1001-based rates (NTSC family)
    "23.976": 10594584e3,
    // TICKS_PER_SECOND * 1001 / 24000
    "29.97": 8475667200,
    //   TICKS_PER_SECOND * 1001 / 30000
    "59.94": 4237833600
    //   TICKS_PER_SECOND * 1001 / 60000
  });
  function ticksToSeconds(ticks) {
    return Number(ticks) / TICKS_PER_SECOND;
  }
  function rateFromTimebase(ticksPerFrame) {
    const tpf = Number(ticksPerFrame);
    if (!Number.isFinite(tpf) || tpf <= 0) {
      throw new RangeError(`Invalid timebase (ticksPerFrame): ${ticksPerFrame}`);
    }
    const fps = TICKS_PER_SECOND / tpf;
    return { ticksPerFrame: tpf, fps, nominalFps: Math.round(fps) };
  }
  function resolveRate({ fps, ticksPerFrame } = {}) {
    if (ticksPerFrame != null) return rateFromTimebase(ticksPerFrame);
    if (fps == null) throw new RangeError("resolveRate requires fps or ticksPerFrame");
    const key = String(fps);
    let tpf = TICKS_PER_FRAME[key] ?? TICKS_PER_FRAME[Number(fps)];
    if (tpf == null) tpf = Math.round(TICKS_PER_SECOND / fps);
    return { ticksPerFrame: tpf, fps: TICKS_PER_SECOND / tpf, nominalFps: Math.round(fps) };
  }
  function secondsToFrames(seconds, rate) {
    const { fps } = normalizeRate(rate);
    return Math.round(seconds * fps);
  }
  function timelineTicksForSeconds(absSeconds, zeroPointTicks, rate) {
    const r = normalizeRate(rate);
    const frame = Math.round(absSeconds * r.fps);
    return zeroPointTicks + frame * r.ticksPerFrame;
  }
  function framesToTimecode(frame, rate, dropFrame = false) {
    const { fps, nominalFps } = normalizeRate(rate);
    let f = Math.round(frame);
    if (f < 0) f = 0;
    if (dropFrame && isDropCapable(fps)) {
      return formatDropFrame(f, fps, nominalFps);
    }
    const fr = nominalFps;
    const frames = f % fr;
    const seconds = Math.floor(f / fr) % 60;
    const minutes = Math.floor(f / (fr * 60)) % 60;
    const hours = Math.floor(f / (fr * 3600)) % 24;
    return `${p(hours)}:${p(minutes)}:${p(seconds)}:${p(frames)}`;
  }
  function formatDuration(seconds) {
    const s = Math.max(0, Math.round(seconds));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor(s % 3600 / 60);
    const ss = s % 60;
    return hh > 0 ? `${hh}:${p(mm)}:${p(ss)}` : `${p(mm)}:${p(ss)}`;
  }
  function normalizeRate(rate) {
    if (rate == null) throw new RangeError("rate is required");
    if (typeof rate === "number") return resolveRate({ fps: rate });
    if (rate.fps != null || rate.ticksPerFrame != null) {
      if (rate.nominalFps != null && rate.ticksPerFrame != null) return rate;
      return resolveRate(rate);
    }
    throw new RangeError("Unrecognized rate descriptor");
  }
  function isDropCapable(fps) {
    return Math.abs(fps - 29.97) < 0.02 || Math.abs(fps - 59.94) < 0.02;
  }
  function formatDropFrame(frameNumber, fps, nominalFps) {
    const dropFrames = Math.round(fps * 0.066666);
    const framesPer10Min = Math.round(fps * 600);
    const framesPerMin = nominalFps * 60 - dropFrames;
    const framesPer24h = Math.round(fps * 3600) * 24;
    let f = frameNumber % framesPer24h;
    const d = Math.floor(f / framesPer10Min);
    const m = f % framesPer10Min;
    if (m > dropFrames) {
      f += dropFrames * 9 * d + dropFrames * Math.floor((m - dropFrames) / framesPerMin);
    } else {
      f += dropFrames * 9 * d;
    }
    const fr = nominalFps;
    const frames = f % fr;
    const seconds = Math.floor(f / fr) % 60;
    const minutes = Math.floor(f / (fr * 60)) % 60;
    const hours = Math.floor(f / (fr * 3600)) % 24;
    return `${p(hours)}:${p(minutes)}:${p(seconds)};${p(frames)}`;
  }
  function p(n) {
    return String(n).padStart(2, "0");
  }

  // src/utils/Logger.js
  var _enabled = false;
  var _buffer = [];
  var MAX_BUFFER = 500;
  function setDevMode(on) {
    _enabled = !!on;
  }
  function log(scope, message, data) {
    const entry = { t: Date.now(), scope, message, data: redact(data) };
    _buffer.push(entry);
    if (_buffer.length > MAX_BUFFER) _buffer.shift();
    if (_enabled) {
      console.log(`[BeatMarker:${scope}] ${message}`, entry.data ?? "");
    }
  }
  function redact(data) {
    if (!data || typeof data !== "object") return data;
    const out = {};
    for (const [k, v] of Object.entries(data)) {
      if (ArrayBuffer.isView(v) || Array.isArray(v)) {
        out[k] = `[${v.constructor?.name || "array"} len=${v.length}]`;
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  // src/premiere/Sequence.js
  async function getActiveSequence() {
    const project = await getActiveProject();
    const seq = await project.getActiveSequence();
    if (!seq) throw new BeatMarkerError(ErrorCode.NO_ACTIVE_SEQUENCE);
    return seq;
  }
  async function readSequenceInfo() {
    const seq = await getActiveSequence();
    const timebase = await seq.getTimebase();
    const rate = rateFromTimebase(timebase);
    const zeroPoint = await seq.getZeroPoint();
    const inPt = await seq.getInPoint();
    const outPt = await seq.getOutPoint();
    const endPt = await seq.getEndTime();
    const zeroPointTicks = tickNum(zeroPoint);
    const inTicks = tickNum(inPt);
    const outTicks = tickNum(outPt);
    const endTicks = tickNum(endPt);
    const info = {
      name: seq.name,
      // VERIFY-IN-PPRO: property vs getName()
      ticksPerFrame: rate.ticksPerFrame,
      fps: rate.fps,
      nominalFps: rate.nominalFps,
      // VERIFY-IN-PPRO: drop-frame flag source (sequence settings). Default false
      // until confirmed; DF affects display only, never marker placement.
      dropFrame: false,
      zeroPointTicks,
      inTicks,
      outTicks,
      endTicks,
      durationSeconds: ticksToSeconds(endTicks - zeroPointTicks)
    };
    log("sequence", "readSequenceInfo", info);
    return info;
  }
  function tickNum(t) {
    if (t == null) return 0;
    if (typeof t === "number") return t;
    if (typeof t.ticksNumber === "number") return t.ticksNumber;
    if (t.ticks != null) return Number(t.ticks);
    return 0;
  }

  // src/premiere/Tracks.js
  async function listAudioTracks() {
    const seq = await getActiveSequence();
    const count = await seq.getAudioTrackCount();
    const tracks = [];
    for (let i = 0; i < count; i++) {
      const track = await seq.getAudioTrack(i);
      tracks.push({
        index: i,
        id: track.id,
        // VERIFY-IN-PPRO: property vs getId()
        name: track.name,
        // VERIFY-IN-PPRO: property vs getName()
        label: `A${i + 1}`
      });
    }
    log("tracks", "listAudioTracks", { count });
    return tracks;
  }
  async function getAudioTrack(index) {
    const seq = await getActiveSequence();
    return seq.getAudioTrack(index);
  }

  // src/premiere/markerTag.js
  var TAG = "[BEAT-MARKER]";
  var TAG_VERSION = 1;
  function buildComment(beat) {
    return `${TAG} v=${TAG_VERSION} type=${beat.type} bar=${beat.bar} beat=${beat.beatInBar} idx=${beat.index}`;
  }
  function buildLabel(beat) {
    if (beat.type === "downbeat") return `BAR ${beat.bar}`;
    const tag = beat.type === "strong" ? "STRONG" : "BEAT";
    return `${tag} ${beat.index}`;
  }
  function isOurs(comments) {
    return typeof comments === "string" && comments.includes(TAG);
  }

  // src/premiere/Markers.js
  var MARKER_TYPE_COMMENT = "Comment";
  async function createMarkers(placements) {
    if (!placements || placements.length === 0) return 0;
    const project = await getActiveProject();
    const seq = await getActiveSequence();
    const api = ppro();
    const markers = api.Markers.getMarkers(seq);
    try {
      const ok = project.executeTransaction((compound) => {
        for (const { beat, ticks } of placements) {
          const start = api.TickTime.createWithTicks(String(ticks));
          const zeroDur = api.TickTime.createWithSeconds(0);
          const action = markers.createAddMarkerAction(
            buildLabel(beat),
            MARKER_TYPE_COMMENT,
            start,
            zeroDur,
            buildComment(beat)
          );
          compound.addAction(action);
        }
      }, "Beat Marker: create markers");
      if (!ok) throw new BeatMarkerError(ErrorCode.MARKER_FAILED);
      log("markers", "createMarkers", { count: placements.length });
      return placements.length;
    } catch (e) {
      throw toBeatMarkerError(e, ErrorCode.MARKER_FAILED);
    }
  }
  async function deleteGeneratedMarkers() {
    const project = await getActiveProject();
    const seq = await getActiveSequence();
    const api = ppro();
    const markers = api.Markers.getMarkers(seq);
    const all = await markers.getMarkers();
    const ours = [];
    for (const m of all) {
      const comments = await readComments(m);
      if (isOurs(comments)) ours.push(m);
    }
    if (ours.length === 0) return 0;
    try {
      const ok = project.executeTransaction((compound) => {
        for (const m of ours) {
          compound.addAction(markers.createRemoveMarkerAction(m));
        }
      }, "Beat Marker: delete generated markers");
      if (!ok) throw new BeatMarkerError(ErrorCode.MARKER_FAILED);
      log("markers", "deleteGeneratedMarkers", { removed: ours.length });
      return ours.length;
    } catch (e) {
      throw toBeatMarkerError(e, ErrorCode.MARKER_FAILED);
    }
  }
  async function readComments(marker) {
    if (typeof marker.comments === "string") return marker.comments;
    if (typeof marker.getComments === "function") return marker.getComments();
    return "";
  }

  // src/beatGrid/BeatGrid.js
  function beatsPerBar(meter) {
    const m = /^(\d+)\s*\/\s*(\d+)$/.exec(String(meter).trim());
    if (!m) throw new RangeError(`Invalid meter: ${meter}`);
    return parseInt(m[1], 10);
  }
  function buildGridFromBpm({
    bpm,
    firstBeat,
    durationSeconds,
    meter = "4/4",
    confidence = 1,
    strengthFn
  }) {
    if (!(bpm > 0)) throw new RangeError(`bpm must be > 0, got ${bpm}`);
    if (!(durationSeconds >= 0)) throw new RangeError("durationSeconds must be >= 0");
    const bpb = beatsPerBar(meter);
    const period = 60 / bpm;
    const beats = [];
    const downbeats = [];
    let index = 1;
    for (let t = firstBeat; t <= firstBeat + durationSeconds + 1e-9; t += period) {
      const beatInBar = (index - 1) % bpb + 1;
      const bar = Math.floor((index - 1) / bpb) + 1;
      const type = beatInBar === 1 ? "downbeat" : "beat";
      const strength = typeof strengthFn === "function" ? clamp01(strengthFn(beatInBar)) : type === "downbeat" ? 1 : 0.6;
      const beat = { time: round6(t), index, bar, beatInBar, strength, type };
      beats.push(beat);
      if (type === "downbeat") downbeats.push(beat.time);
      index += 1;
    }
    return {
      bpm,
      meter,
      confidence: clamp01(confidence),
      firstBeat: round6(firstBeat),
      beats,
      downbeats
    };
  }
  function validateGrid(grid) {
    if (!grid || typeof grid !== "object") throw new Error("grid missing");
    if (!(grid.bpm > 0)) throw new Error("grid.bpm invalid");
    if (!Array.isArray(grid.beats)) throw new Error("grid.beats missing");
    for (let i = 1; i < grid.beats.length; i++) {
      if (grid.beats[i].time < grid.beats[i - 1].time) {
        throw new Error(`beats not monotonic at index ${i}`);
      }
    }
    return true;
  }
  function clamp01(n) {
    return Math.max(0, Math.min(1, n));
  }
  function round6(n) {
    return Math.round(n * 1e6) / 1e6;
  }

  // src/beatGrid/markerModes.js
  var MarkerMode = Object.freeze({
    ALL_BEATS: "ALL_BEATS",
    STRONG_BEATS: "STRONG_BEATS",
    DOWNBEATS: "DOWNBEATS",
    EVERY_2_BEATS: "EVERY_2_BEATS",
    EVERY_4_BEATS: "EVERY_4_BEATS"
  });
  var MODES = {
    [MarkerMode.ALL_BEATS]: () => true,
    [MarkerMode.STRONG_BEATS]: (b, ctx) => b.type === "downbeat" || b.type === "strong" || b.strength >= (ctx.strongThreshold ?? 0.75),
    [MarkerMode.DOWNBEATS]: (b) => b.type === "downbeat",
    [MarkerMode.EVERY_2_BEATS]: (b) => (b.beatInBar - 1) % 2 === 0,
    [MarkerMode.EVERY_4_BEATS]: (b) => (b.beatInBar - 1) % 4 === 0
  };
  function selectBeats(grid, mode, ctx = {}) {
    const predicate = MODES[mode];
    if (!predicate) throw new RangeError(`Unknown marker mode: ${mode}`);
    return grid.beats.filter((b) => predicate(b, ctx));
  }

  // src/beatGrid/placement.js
  function computePlacements(grid, mode, seqInfo2, opts = {}) {
    const {
      strongThreshold = 0.75,
      rangeStartSeconds: rangeStartSeconds2 = 0,
      extraOffsetSeconds = 0,
      clampToEnd = true
    } = opts;
    const rate = {
      ticksPerFrame: seqInfo2.ticksPerFrame,
      fps: seqInfo2.fps,
      nominalFps: seqInfo2.nominalFps
    };
    const zero = seqInfo2.zeroPointTicks;
    const end = seqInfo2.endTicks;
    const selected = selectBeats(grid, mode, { strongThreshold });
    const seen = /* @__PURE__ */ new Set();
    const placements = [];
    for (const beat of selected) {
      const abs = beat.time + rangeStartSeconds2 + extraOffsetSeconds;
      if (abs < 0) continue;
      const ticks = timelineTicksForSeconds(abs, zero, rate);
      if (clampToEnd && end != null && ticks > end) continue;
      if (seen.has(ticks)) continue;
      seen.add(ticks);
      placements.push({ beat, ticks });
    }
    placements.sort((a, b) => a.ticks - b.ticks);
    return placements;
  }

  // src/audio/WaveReader.js
  function decodeWav(input) {
    const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    if (buf.length < 12 || str(buf, 0, 4) !== "RIFF" || str(buf, 8, 4) !== "WAVE") {
      throw new BeatMarkerError(ErrorCode.DECODE_FAILED, "Not a valid WAV file.");
    }
    let fmt2 = null;
    let dataOffset = -1;
    let dataLength = 0;
    let p2 = 12;
    while (p2 + 8 <= buf.length) {
      const id = str(buf, p2, 4);
      const size = dv.getUint32(p2 + 4, true);
      const body = p2 + 8;
      if (id === "fmt ") {
        fmt2 = {
          audioFormat: dv.getUint16(body, true),
          channels: dv.getUint16(body + 2, true),
          sampleRate: dv.getUint32(body + 4, true),
          bitsPerSample: dv.getUint16(body + 14, true)
        };
      } else if (id === "data") {
        dataOffset = body;
        dataLength = Math.min(size, buf.length - body);
      }
      p2 = body + size + (size & 1);
    }
    if (!fmt2) throw new BeatMarkerError(ErrorCode.DECODE_FAILED, "WAV missing fmt chunk.");
    if (dataOffset < 0) throw new BeatMarkerError(ErrorCode.DECODE_FAILED, "WAV missing data chunk.");
    const { audioFormat, channels, sampleRate, bitsPerSample } = fmt2;
    const isFloat = audioFormat === 3;
    const isPcm = audioFormat === 1;
    if (!isPcm && !isFloat || channels < 1) {
      throw new BeatMarkerError(
        ErrorCode.UNSUPPORTED_FORMAT,
        `Unsupported WAV encoding (format ${audioFormat}, ${bitsPerSample}-bit).`
      );
    }
    const bytesPerSample = bitsPerSample / 8;
    const frameBytes = bytesPerSample * channels;
    const frameCount = Math.floor(dataLength / frameBytes);
    const mono = new Float32Array(frameCount);
    const readOne = sampleReader(dv, isFloat, bitsPerSample);
    if (!readOne) {
      throw new BeatMarkerError(
        ErrorCode.UNSUPPORTED_FORMAT,
        `Unsupported WAV bit depth: ${bitsPerSample}-bit.`
      );
    }
    for (let i = 0; i < frameCount; i++) {
      const base = dataOffset + i * frameBytes;
      let sum = 0;
      for (let c = 0; c < channels; c++) sum += readOne(base + c * bytesPerSample);
      mono[i] = sum / channels;
    }
    return {
      sampleRate,
      channels,
      samples: mono,
      durationSeconds: frameCount / sampleRate,
      bitDepth: bitsPerSample,
      format: isFloat ? "float" : "pcm"
    };
  }
  function sampleReader(dv, isFloat, bits) {
    if (isFloat && bits === 32) return (o) => dv.getFloat32(o, true);
    if (isFloat && bits === 64) return (o) => dv.getFloat64(o, true);
    if (!isFloat && bits === 16) return (o) => dv.getInt16(o, true) / 32768;
    if (!isFloat && bits === 32) return (o) => dv.getInt32(o, true) / 2147483648;
    if (!isFloat && bits === 24) {
      return (o) => {
        const b0 = dv.getUint8(o);
        const b1 = dv.getUint8(o + 1);
        const b2 = dv.getUint8(o + 2);
        let v = b0 | b1 << 8 | b2 << 16;
        if (v & 8388608) v |= ~16777215;
        return v / 8388608;
      };
    }
    return null;
  }
  function str(buf, off, len) {
    let s = "";
    for (let i = 0; i < len; i++) s += String.fromCharCode(buf[off + i]);
    return s;
  }

  // src/audio/waveformPeaks.js
  function computePeaks(samples, buckets) {
    const b = Math.max(1, Math.floor(buckets));
    const mins = new Float32Array(b);
    const maxs = new Float32Array(b);
    const n = samples.length;
    if (n === 0) return { mins, maxs, buckets: b };
    for (let i = 0; i < b; i++) {
      const start = Math.floor(i * n / b);
      const end = Math.max(start + 1, Math.floor((i + 1) * n / b));
      let mn = Infinity;
      let mx = -Infinity;
      for (let j = start; j < end && j < n; j++) {
        const v = samples[j];
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      mins[i] = mn === Infinity ? 0 : mn;
      maxs[i] = mx === -Infinity ? 0 : mx;
    }
    return { mins, maxs, buckets: b };
  }

  // src/engine/timelineAssemble.js
  function assembleTrackAudio(clips, opts = {}) {
    if (!clips || clips.length === 0) {
      return { samples: new Float32Array(0), sampleRate: opts.targetRate || 48e3, rangeStartSeconds: 0, spanSeconds: 0, gaps: [] };
    }
    const targetRate = opts.targetRate || clips[0].sampleRate || 48e3;
    const norm = clips.map((c) => {
      const samples = c.sampleRate === targetRate ? c.samples : resampleLinear(c.samples, c.sampleRate, targetRate);
      return { startSeconds: c.startSeconds, samples, durationSeconds: samples.length / targetRate };
    }).sort((a, b) => a.startSeconds - b.startSeconds);
    const rangeStart = norm[0].startSeconds;
    const rangeEnd = Math.max(...norm.map((c) => c.startSeconds + c.durationSeconds));
    const spanSeconds = rangeEnd - rangeStart;
    const total = Math.max(0, Math.round(spanSeconds * targetRate));
    const out = new Float32Array(total);
    const covered = [];
    for (const c of norm) {
      const offset = Math.round((c.startSeconds - rangeStart) * targetRate);
      for (let i = 0; i < c.samples.length && offset + i < total; i++) {
        out[offset + i] += c.samples[i];
      }
      covered.push([c.startSeconds - rangeStart, c.startSeconds - rangeStart + c.durationSeconds]);
    }
    return { samples: out, sampleRate: targetRate, rangeStartSeconds: rangeStart, spanSeconds, gaps: gapsFromCovered(covered, spanSeconds) };
  }
  function resampleLinear(samples, srcRate, dstRate) {
    if (srcRate === dstRate) return samples;
    const ratio = dstRate / srcRate;
    const outLen = Math.max(0, Math.round(samples.length * ratio));
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const srcPos = i / ratio;
      const i0 = Math.floor(srcPos);
      const i1 = Math.min(samples.length - 1, i0 + 1);
      const frac = srcPos - i0;
      out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
    }
    return out;
  }
  function gapsFromCovered(covered, span) {
    if (covered.length === 0) return [];
    const sorted = [...covered].sort((a, b) => a[0] - b[0]);
    const merged = [sorted[0].slice()];
    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      if (sorted[i][0] <= last[1] + 1e-9) last[1] = Math.max(last[1], sorted[i][1]);
      else merged.push(sorted[i].slice());
    }
    const gaps = [];
    let cursor = 0;
    for (const [s, e] of merged) {
      if (s - cursor > 1e-6) gaps.push([cursor, s]);
      cursor = Math.max(cursor, e);
    }
    if (span - cursor > 1e-6) gaps.push([cursor, span]);
    return gaps;
  }

  // src/premiere/FileSource.js
  function uxpFs() {
    const uxp2 = hostRequire("uxp");
    const fs = uxp2?.storage?.localFileSystem;
    if (!fs) throw new BeatMarkerError(ErrorCode.UXP_UNAVAILABLE);
    return { fs, formats: uxp2.storage.formats };
  }
  async function pickAudioFile() {
    const { fs, formats } = uxpFs();
    const entry = await fs.getFileForOpening({ types: ["wav", "mp3"], allowMultiple: false });
    if (!entry) return null;
    const name = entry.name || "audio";
    const ext = name.toLowerCase().split(".").pop();
    if (ext !== "wav" && ext !== "mp3") {
      throw new BeatMarkerError(ErrorCode.UNSUPPORTED_FORMAT);
    }
    const data = await entry.read({ format: formats.binary });
    const buffer = data instanceof Uint8Array ? data : new Uint8Array(data);
    log("file", "pickAudioFile", { name, ext, sizeBytes: buffer.length });
    return { name, ext, buffer, sizeBytes: buffer.length };
  }
  async function saveTextFile(text, suggestedName) {
    const { fs, formats } = uxpFs();
    const entry = await fs.getFileForSaving(suggestedName);
    if (!entry) return false;
    await entry.write(text, { format: formats.utf8 });
    log("file", "saveTextFile", { name: entry.name, bytes: text.length });
    return true;
  }

  // src/beatGrid/exportGrid.js
  function gridToJSON(grid, opts = {}) {
    const { seqInfo: seqInfo2, rangeStartSeconds: rangeStartSeconds2 = 0, extraOffsetSeconds = 0, pretty = true } = opts;
    const tc = timecoder(seqInfo2, rangeStartSeconds2 + extraOffsetSeconds);
    const out = {
      bpm: grid.bpm,
      meter: grid.meter,
      confidence: grid.confidence,
      firstBeat: grid.firstBeat,
      beatCount: grid.beats.length,
      beats: grid.beats.map((b) => tc ? { ...b, timelineTimecode: tc(b.time) } : { ...b }),
      downbeats: grid.downbeats
    };
    return JSON.stringify(out, null, pretty ? 2 : 0);
  }
  function gridToCSV(grid, opts = {}) {
    const { seqInfo: seqInfo2, rangeStartSeconds: rangeStartSeconds2 = 0, extraOffsetSeconds = 0 } = opts;
    const tc = timecoder(seqInfo2, rangeStartSeconds2 + extraOffsetSeconds);
    const header = ["index", "bar", "beatInBar", "type", "timeSeconds", "strength"];
    if (tc) header.push("timelineTimecode");
    const rows = [header.join(",")];
    for (const b of grid.beats) {
      const row = [b.index, b.bar, b.beatInBar, b.type, fmt(b.time), fmt(b.strength)];
      if (tc) row.push(tc(b.time));
      rows.push(row.join(","));
    }
    return rows.join("\n");
  }
  function timecoder(seqInfo2, offsetSeconds2) {
    if (!seqInfo2 || seqInfo2.ticksPerFrame == null) return null;
    const zeroFrame = seqInfo2.zeroPointTicks / seqInfo2.ticksPerFrame;
    return (t) => {
      const frame = secondsToFrames(t + offsetSeconds2, seqInfo2) + zeroFrame;
      return framesToTimecode(frame, seqInfo2, !!seqInfo2.dropFrame);
    };
  }
  function fmt(n) {
    return String(Math.round(n * 1e6) / 1e6);
  }

  // src/premiere/Clips.js
  async function listClips(trackIndex) {
    const track = await getAudioTrack(trackIndex);
    const api = ppro();
    const clipType = api?.Constants?.TrackItemType?.CLIP;
    const items = await track.getTrackItems(clipType, false);
    const clips = [];
    for (const item of items) {
      const start = tickNum2(await item.getStartTime());
      const end = tickNum2(await item.getEndTime());
      const inPt = tickNum2(await item.getInPoint());
      const outPt = tickNum2(await item.getOutPoint());
      let name;
      let mediaPath;
      try {
        const projectItem = await item.getProjectItem();
        name = projectItem?.name;
        if (typeof projectItem?.getMediaFilePath === "function") {
          mediaPath = await projectItem.getMediaFilePath();
        }
      } catch (e) {
        log("clips", "projectItem read failed", { message: String(e) });
      }
      clips.push({
        startTicks: start,
        endTicks: end,
        inTicks: inPt,
        outTicks: outPt,
        startSeconds: ticksToSeconds(start),
        endSeconds: ticksToSeconds(end),
        inSeconds: ticksToSeconds(inPt),
        outSeconds: ticksToSeconds(outPt),
        durationSeconds: ticksToSeconds(end - start),
        name,
        mediaPath
      });
    }
    clips.sort((a, b) => a.startTicks - b.startTicks);
    if (clips.length === 0) throw new BeatMarkerError(ErrorCode.NO_AUDIO_CLIPS);
    log("clips", "listClips", { trackIndex, count: clips.length });
    return clips;
  }
  function tickNum2(t) {
    if (t == null) return 0;
    if (typeof t === "number") return t;
    if (typeof t.ticksNumber === "number") return t.ticksNumber;
    if (t.ticks != null) return Number(t.ticks);
    return 0;
  }

  // src/premiere/AudioExtractor.js
  var TEMP_DIRNAME = "beat-marker-cache";
  function uxp() {
    return hostRequire("uxp");
  }
  async function tempFolder() {
    const fs = uxp()?.storage?.localFileSystem;
    if (!fs) throw new BeatMarkerError(ErrorCode.UXP_UNAVAILABLE);
    const dataFolder = await fs.getDataFolder();
    try {
      return await dataFolder.getEntry(TEMP_DIRNAME);
    } catch {
      return await dataFolder.createFolder(TEMP_DIRNAME);
    }
  }
  function uniqueName(prefix) {
    const id = Math.random().toString(16).slice(2, 8);
    return `${prefix}_${Date.now().toString(16)}_${id}.wav`;
  }
  var _created = [];
  async function renderTimelineAudio(opts) {
    const { mode, trackIndex, range, presetPath: presetPath2, onProgress, isCancelled } = opts;
    if (!presetPath2) {
      throw new BeatMarkerError(
        ErrorCode.EXPORT_FAILED,
        "A PCM WAV export preset (.epr) is required to render timeline audio."
      );
    }
    const api = ppro();
    const encoder = api.EncoderManager ? await api.EncoderManager.getManager() : api.app?.encoder;
    if (!encoder) throw new BeatMarkerError(ErrorCode.EXPORT_FAILED, "Encoder is unavailable.");
    try {
      if (mode === "mix") {
        if (isCancelled && isCancelled()) throw cancelled();
        const buffer = await renderSequenceMix(encoder, presetPath2, range, onProgress, isCancelled);
        return { mode, buffer };
      }
      const clips = await listClips(trackIndex);
      const filtered = range ? clipsInRange(clips, range) : clips;
      if (filtered.length === 0) throw new BeatMarkerError(ErrorCode.NO_AUDIO_CLIPS);
      const out = [];
      for (let i = 0; i < filtered.length; i++) {
        if (isCancelled && isCancelled()) throw cancelled();
        const clip = filtered[i];
        const buffer = await renderClip(encoder, clip, presetPath2);
        out.push({ startSeconds: clip.startSeconds, buffer });
        if (onProgress) onProgress((i + 1) / filtered.length);
      }
      return { mode, clips: out };
    } catch (e) {
      if (e && e.cancelled) throw e;
      throw toBeatMarkerError(e, ErrorCode.EXPORT_FAILED);
    }
  }
  async function renderClip(encoder, clip, presetPath2) {
    const folder = await tempFolder();
    const file = await folder.createFile(uniqueName("clip"), { overwrite: true });
    _created.push(file);
    const projectItem = clip.projectItem || clip.getProjectItem && await clip.getProjectItem();
    await encoder.encodeProjectItem(
      projectItem,
      file.nativePath,
      presetPath2,
      /*workArea*/
      1,
      false
    );
    return readBytes(file);
  }
  async function renderSequenceMix(encoder, presetPath2, range, onProgress, isCancelled) {
    if (isCancelled && isCancelled()) throw cancelled();
    const api = ppro();
    const project = await api.Project.getActiveProject();
    const sequence = await project.getActiveSequence();
    const folder = await tempFolder();
    const file = await folder.createFile(uniqueName("mix"), { overwrite: true });
    _created.push(file);
    const workArea = range && range.inTicks != null ? 2 : 0;
    await encoder.encodeSequence(sequence, file.nativePath, presetPath2, workArea, false);
    if (isCancelled && isCancelled()) throw cancelled();
    if (onProgress) onProgress(1);
    return readBytes(file);
  }
  async function readBytes(fileEntry) {
    const formats = uxp().storage.formats;
    const data = await fileEntry.read({ format: formats.binary });
    return data instanceof Uint8Array ? data : new Uint8Array(data);
  }
  async function cleanup() {
    for (const entry of _created.splice(0)) {
      try {
        await entry.delete();
      } catch (e) {
        log("extractor", "cleanup failed", { message: String(e) });
      }
    }
  }
  function clipsInRange(clips, range) {
    const inT = range.inTicks ?? -Infinity;
    const outT = range.outTicks ?? Infinity;
    return clips.filter((c) => c.endTicks > inT && c.startTicks < outT);
  }
  function cancelled() {
    const e = new Error("cancelled");
    e.cancelled = true;
    return e;
  }

  // src/settings/SettingsStore.js
  var DEFAULTS = Object.freeze({
    defaultBpm: "auto",
    // 'auto' or a number
    defaultMeter: "auto",
    // 'auto' | '4/4' | '3/4'
    sensitivity: 50,
    // 0..100
    defaultMarkerMode: "STRONG_BEATS",
    firstBeatOffsetMs: 0,
    keepTemp: false,
    cacheEnabled: true,
    devMode: false,
    pcmWavPreset: ""
    // path to a PCM WAV .epr export preset
  });
  var STORAGE_KEY = "beatMarker.settings";
  var SettingsStore = class {
    /** @param {{ getItem:(k:string)=>?string, setItem:(k:string,v:string)=>void }} backend */
    constructor(backend) {
      this.backend = backend || memoryBackend();
      this.values = { ...DEFAULTS };
    }
    /** Load and merge persisted values over the defaults. Never throws. */
    load() {
      try {
        const raw = this.backend.getItem(STORAGE_KEY);
        if (raw) this.values = mergeKnown(DEFAULTS, JSON.parse(raw));
      } catch {
        this.values = { ...DEFAULTS };
      }
      return this.values;
    }
    get(key) {
      return this.values[key];
    }
    all() {
      return { ...this.values };
    }
    /** Set one or many values (validated), then persist. */
    set(patch, value) {
      const updates = typeof patch === "string" ? { [patch]: value } : patch;
      for (const [k, v] of Object.entries(updates)) {
        if (k in DEFAULTS) this.values[k] = coerce(k, v);
      }
      this.save();
      return this.values;
    }
    save() {
      try {
        this.backend.setItem(STORAGE_KEY, JSON.stringify(this.values));
      } catch {
      }
    }
    reset() {
      this.values = { ...DEFAULTS };
      this.save();
      return this.values;
    }
  };
  function mergeKnown(defaults, incoming) {
    const out = { ...defaults };
    if (incoming && typeof incoming === "object") {
      for (const k of Object.keys(defaults)) {
        if (k in incoming) out[k] = coerce(k, incoming[k]);
      }
    }
    return out;
  }
  function coerce(key, v) {
    const def = DEFAULTS[key];
    if (typeof def === "boolean") return !!v;
    if (typeof def === "number") {
      const n = Number(v);
      return Number.isFinite(n) ? n : def;
    }
    return v;
  }
  function memoryBackend() {
    const map = /* @__PURE__ */ new Map();
    return {
      getItem: (k) => map.has(k) ? map.get(k) : null,
      setItem: (k, v) => map.set(k, v)
    };
  }

  // src/audio/fft.js
  function fft(re, im) {
    const n = re.length;
    if (n <= 1) return;
    if ((n & n - 1) !== 0) throw new RangeError(`FFT size must be a power of 2, got ${n}`);
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        const tr = re[i];
        re[i] = re[j];
        re[j] = tr;
        const ti = im[i];
        im[i] = im[j];
        im[j] = ti;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len;
      const wpr = Math.cos(ang);
      const wpi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let wr = 1;
        let wi = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k;
          const b = i + k + len / 2;
          const tr = wr * re[b] - wi * im[b];
          const ti = wr * im[b] + wi * re[b];
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
          const nwr = wr * wpr - wi * wpi;
          wi = wr * wpi + wi * wpr;
          wr = nwr;
        }
      }
    }
  }
  function magnitudeSpectrum(frame) {
    const n = frame.length;
    const re = Float64Array.from(frame);
    const im = new Float64Array(n);
    fft(re, im);
    const half = n / 2;
    const mag = new Float64Array(half + 1);
    for (let k = 0; k <= half; k++) mag[k] = Math.hypot(re[k], im[k]);
    return mag;
  }

  // src/engine/dsp.js
  var FRAME = 1024;
  var HOP = 512;
  function onsetEnvelope(x, sampleRate) {
    const hann = hannWindow(FRAME);
    const nFrames = Math.max(0, 1 + Math.floor((x.length - FRAME) / HOP));
    const env = new Float64Array(Math.max(0, nFrames));
    const frame = new Float64Array(FRAME);
    let prev = null;
    for (let f = 0; f < nFrames; f++) {
      const start = f * HOP;
      for (let i = 0; i < FRAME; i++) frame[i] = x[start + i] * hann[i];
      const mag = magnitudeSpectrum(frame);
      if (prev) {
        let flux = 0;
        for (let k = 0; k < mag.length; k++) {
          const d = mag[k] - prev[k];
          if (d > 0) flux += d;
        }
        env[f] = flux;
      }
      prev = mag;
    }
    smoothSubtract(env, 8);
    normalizeMax(env);
    return { env, fps: sampleRate / HOP };
  }
  function estimateTempo(env, fps, minBpm = 40, maxBpm = 220) {
    const lagMin = Math.max(2, Math.floor(fps * 60 / maxBpm));
    const lagMax = Math.min(env.length - 1, Math.ceil(fps * 60 / minBpm));
    let bestLag = lagMin;
    let bestVal = -Infinity;
    const r = new Float64Array(lagMax + 1);
    for (let lag2 = lagMin; lag2 <= lagMax; lag2++) {
      let s = 0;
      for (let n = lag2; n < env.length; n++) s += env[n] * env[n - lag2];
      r[lag2] = s;
      if (s > bestVal) {
        bestVal = s;
        bestLag = lag2;
      }
    }
    let lag = bestLag;
    if (bestLag > lagMin && bestLag < lagMax) {
      const a = r[bestLag - 1];
      const b = r[bestLag];
      const c = r[bestLag + 1];
      const denom = a - 2 * b + c;
      if (denom !== 0) lag = bestLag + 0.5 * (a - c) / denom;
    }
    const bpm = fps * 60 / lag;
    const energy = sumSquares(env) || 1;
    return { bpm, periodFrames: lag, strength: bestVal / energy };
  }
  function trackBeats(env, periodFrames) {
    const period = periodFrames;
    const nBeats = Math.floor((env.length - 1) / period);
    if (nBeats < 1) return [];
    let bestPhase = 0;
    let bestScore = -Infinity;
    const steps = Math.max(8, Math.ceil(period * 4));
    for (let s = 0; s < steps; s++) {
      const phase = s / steps * period;
      let score = 0;
      for (let k = 0; k <= nBeats; k++) {
        const idx = Math.round(phase + k * period);
        if (idx >= 0 && idx < env.length) score += env[idx];
      }
      if (score > bestScore) {
        bestScore = score;
        bestPhase = phase;
      }
    }
    const beats = [];
    for (let k = 0; k <= nBeats; k++) {
      const idx = phaseRefine(env, bestPhase + k * period);
      if (idx >= 0 && idx < env.length) beats.push(idx);
    }
    return beats;
  }
  function estimateMeterFromAccents(positions, strengths, candidates = [4, 3]) {
    let best = { bpb: candidates[0] ?? 4, downbeatOffset: 0, contrast: -Infinity };
    for (const bpb of candidates) {
      for (let d = 0; d < bpb; d++) {
        let onSum = 0;
        let onCount = 0;
        let offSum = 0;
        let offCount = 0;
        for (let i = 0; i < positions.length; i++) {
          if (((positions[i] - d) % bpb + bpb) % bpb === 0) {
            onSum += strengths[i];
            onCount++;
          } else {
            offSum += strengths[i];
            offCount++;
          }
        }
        const onAvg = onCount ? onSum / onCount : 0;
        const offAvg = offCount ? offSum / offCount : 0;
        const contrast = onAvg - offAvg;
        if (contrast > best.contrast) best = { bpb, downbeatOffset: d, contrast };
      }
    }
    return best;
  }
  function onsetPeaks(env, fps, threshold = 0.2) {
    const peaks = [];
    for (let i = 1; i < env.length - 1; i++) {
      if (env[i] >= threshold && env[i] > env[i - 1] && env[i] >= env[i + 1]) {
        peaks.push(i / fps);
      }
    }
    return peaks;
  }
  function phaseRefine(env, pos) {
    const i = Math.round(pos);
    let best = i;
    for (let j = Math.max(1, i - 1); j <= Math.min(env.length - 2, i + 1); j++) {
      if (env[j] > env[best]) best = j;
    }
    return best;
  }
  function hannWindow(n) {
    const w = new Float64Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
    return w;
  }
  function smoothSubtract(env, radius) {
    const out = new Float64Array(env.length);
    for (let i = 0; i < env.length; i++) {
      let s = 0;
      let c = 0;
      for (let j = Math.max(0, i - radius); j <= Math.min(env.length - 1, i + radius); j++) {
        s += env[j];
        c++;
      }
      const local = c ? s / c : 0;
      out[i] = Math.max(0, env[i] - local);
    }
    env.set(out);
  }
  function normalizeMax(env) {
    let m = 0;
    for (let i = 0; i < env.length; i++) if (env[i] > m) m = env[i];
    if (m > 0) for (let i = 0; i < env.length; i++) env[i] /= m;
  }
  function sumSquares(a) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * a[i];
    return s;
  }

  // src/beatGrid/bpm.js
  var DEFAULT_MIN_BPM = 40;
  var DEFAULT_MAX_BPM = 220;
  function harmonicCandidates(bpm, min = DEFAULT_MIN_BPM, max = DEFAULT_MAX_BPM) {
    if (!(bpm > 0)) throw new RangeError(`bpm must be > 0, got ${bpm}`);
    const set = /* @__PURE__ */ new Set();
    const factors = [0.25, 1 / 3, 0.5, 2 / 3, 1, 1.5, 2, 3, 4];
    for (const f of factors) {
      const c = bpm * f;
      if (c >= min && c <= max) set.add(round2(c));
    }
    return [...set].sort((a, b) => a - b);
  }
  function correctOctave(rawBpm, opts = {}) {
    const { onsets, min = DEFAULT_MIN_BPM, max = DEFAULT_MAX_BPM, preferred = 120 } = opts;
    const candidates = harmonicCandidates(rawBpm, min, max);
    if (candidates.length === 0) return { bpm: round2(rawBpm), candidates: [rawBpm], scores: {} };
    const hasOnsets = Array.isArray(onsets) && onsets.length > 2;
    const scores = {};
    for (const c of candidates) {
      const prior = softPrior(c, preferred);
      const fit = hasOnsets ? tempoScore(onsets, c) : 0;
      scores[c] = fit * 1 + prior * 0.15;
    }
    let best = candidates[0];
    for (const c of candidates) if (scores[c] > scores[best]) best = c;
    return { bpm: best, candidates, scores };
  }
  function tempoScore(onsets, bpm) {
    if (!Array.isArray(onsets) || onsets.length < 3) return 0;
    const P = 60 / bpm;
    if (!(P > 0)) return 0;
    const s = [...onsets].sort((a, b) => a - b);
    const span = s[s.length - 1] - s[0];
    if (span <= 0) return 0;
    let consistent = 0;
    let total = 0;
    for (let i = 1; i < s.length; i++) {
      const ratio = (s[i] - s[i - 1]) / P;
      const k = Math.round(ratio);
      total++;
      if (k >= 1 && Math.abs(ratio - k) <= 0.18) consistent++;
    }
    const C = total ? consistent / total : 0;
    const gridBeats = span / P;
    const D = gridBeats > 0 ? (s.length - 1) / gridBeats : 0;
    const densityScore = D <= 1 ? D : 1 / D;
    return 0.55 * C + 0.45 * densityScore;
  }
  function softPrior(bpm, preferred) {
    const sigma = 40;
    const d = (bpm - preferred) / sigma;
    return Math.exp(-0.5 * d * d);
  }
  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  // src/engine/analyze.js
  function analyzeAudioJs(audio, options = {}) {
    const { samples, sampleRate } = audio;
    const {
      minBpm = 40,
      maxBpm = 220,
      manualBpm,
      sensitivity = 0.5,
      silenceFloor = 5e-3,
      meterHint = "auto",
      onProgress,
      isCancelled
    } = options;
    const tick = (p2) => {
      if (typeof onProgress === "function") onProgress(p2);
      if (typeof isCancelled === "function" && isCancelled()) {
        const e = new Error("cancelled");
        e.cancelled = true;
        throw e;
      }
    };
    tick(0.05);
    const { env, fps } = onsetEnvelope(samples, sampleRate);
    tick(0.5);
    if (env.length < 4) {
      return { bpm: manualBpm || 0, meter: "4/4", confidence: 0, firstBeat: 0, beats: [], downbeats: [] };
    }
    let bpm;
    let tempoStrength;
    if (manualBpm && manualBpm > 0) {
      bpm = manualBpm;
      tempoStrength = 1;
    } else {
      const t = estimateTempo(env, fps, minBpm, maxBpm);
      const peaks = onsetPeaks(env, fps, 0.15 + 0.2 * (1 - sensitivity));
      bpm = correctOctave(t.bpm, { onsets: peaks, min: minBpm, max: maxBpm }).bpm;
      tempoStrength = t.strength;
    }
    tick(0.65);
    const periodFrames = fps * 60 / bpm;
    const periodSeconds = 60 / bpm;
    let beatFrames = trackBeats(env, periodFrames);
    const rmsWin = Math.max(1, Math.round(sampleRate * 0.05));
    beatFrames = beatFrames.filter(
      (f) => localRms(samples, Math.round(f * sampleRate / fps), rmsWin) >= silenceFloor
    );
    tick(0.85);
    if (beatFrames.length === 0) {
      return { bpm: round22(bpm), meter: "4/4", confidence: 0, firstBeat: 0, beats: [], downbeats: [] };
    }
    const strongThreshold = 0.6 + 0.3 * (1 - sensitivity);
    const t0 = beatFrames[0] / fps;
    const giList = beatFrames.map((f) => Math.round((f / fps - t0) / periodSeconds));
    const strengthList = beatFrames.map((f) => clamp012(env[Math.min(env.length - 1, f)]));
    const meterCandidates = meterHint === "3/4" ? [3] : meterHint === "4/4" ? [4] : [4, 3];
    const { bpb, downbeatOffset, contrast } = estimateMeterFromAccents(giList, strengthList, meterCandidates);
    const meter = `${bpb}/4`;
    const rawBeats = beatFrames.map((f, i) => {
      const time = f / fps;
      const gi = giList[i];
      const beatInBar = ((gi - downbeatOffset) % bpb + bpb) % bpb + 1;
      const strength = strengthList[i];
      return { time, gi, beatInBar, strength, _rawBar: Math.floor((gi - downbeatOffset) / bpb) };
    });
    const minBar = Math.min(...rawBeats.map((b) => b._rawBar));
    const beats = rawBeats.map((b, i) => {
      const bar = b._rawBar - minBar + 1;
      const type = b.beatInBar === 1 ? "downbeat" : b.strength >= strongThreshold ? "strong" : "beat";
      return { time: round62(b.time), index: i + 1, bar, beatInBar: b.beatInBar, strength: round3(b.strength), type };
    });
    const downbeats = beats.filter((b) => b.type === "downbeat").map((b) => b.time);
    const meanBeatStrength = beats.length ? beats.reduce((s, b) => s + b.strength, 0) / beats.length : 0;
    const confidence = clamp012(0.5 * clamp012(tempoStrength * 4) + 0.5 * meanBeatStrength);
    tick(1);
    const grid = {
      bpm: round22(bpm),
      meter,
      confidence: round3(confidence),
      firstBeat: beats.length ? beats[0].time : 0,
      beats,
      downbeats,
      source: { engine: "js", sampleRate, meterContrast: round3(contrast) }
    };
    validateGrid(grid);
    return grid;
  }
  function localRms(samples, center, win) {
    const half = win >> 1;
    let s = 0;
    let n = 0;
    const a = Math.max(0, center - half);
    const b = Math.min(samples.length, center + half);
    for (let i = a; i < b; i++) {
      s += samples[i] * samples[i];
      n++;
    }
    return n ? Math.sqrt(s / n) : 0;
  }
  function clamp012(n) {
    return Math.max(0, Math.min(1, n));
  }
  function round62(n) {
    return Math.round(n * 1e6) / 1e6;
  }
  function round3(n) {
    return Math.round(n * 1e3) / 1e3;
  }
  function round22(n) {
    return Math.round(n * 100) / 100;
  }

  // src/engine/index.js
  var ENGINES = {
    js: analyzeAudioJs,
    native: nativeNotAvailable,
    wasm: wasmNotAvailable
  };
  var _preferred = "js";
  function analyzeAudio(audio, options = {}) {
    const name = options.engine || _preferred;
    const fn = ENGINES[name] || ENGINES.js;
    return fn(audio, options);
  }
  function nativeNotAvailable() {
    throw new BeatMarkerError(
      ErrorCode.ENGINE_MISSING,
      "Native engine (.uxpaddon) is not built in this environment."
    );
  }
  function wasmNotAvailable() {
    throw new BeatMarkerError(ErrorCode.ENGINE_MISSING, "WASM engine is not built in this environment.");
  }

  // src/analysis/fingerprint.js
  var FNV_OFFSET = 2166136261;
  var FNV_PRIME = 16777619;
  function fingerprint(samples, sampleRate, durationSeconds) {
    const n = samples.length;
    const dur = durationSeconds ?? n / sampleRate;
    let h = FNV_OFFSET >>> 0;
    h = mix(h, Math.round(sampleRate));
    h = mix(h, Math.round(dur * 1e3));
    h = mix(h, n);
    const points = Math.min(4096, n);
    const stride = points > 0 ? Math.max(1, Math.floor(n / points)) : 1;
    for (let i = 0; i < n; i += stride) {
      h = mix(h, Math.round(samples[i] * 1e3));
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  function optionsKey(options = {}) {
    const { minBpm = 40, maxBpm = 220, sensitivity = 0.5, manualBpm = 0, meterHint = "auto" } = options;
    return [minBpm, maxBpm, round(sensitivity), round(manualBpm), meterHint].join(":");
  }
  function mix(h, value) {
    h ^= value & 4294967295;
    h = Math.imul(h, FNV_PRIME);
    return h >>> 0;
  }
  function round(n) {
    return Math.round(Number(n) * 1e3) / 1e3;
  }

  // src/analysis/Analyzer.js
  var Analyzer = class {
    /**
     * @param {Object} [opts]
     * @param {number} [opts.maxEntries=32]
     * @param {boolean} [opts.enabled=true]
     * @param {(audio, options)=>object} [opts.analyzeFn] injectable (tests)
     */
    constructor({ maxEntries = 32, enabled = true, analyzeFn = analyzeAudio } = {}) {
      this.maxEntries = maxEntries;
      this.enabled = enabled;
      this.analyzeFn = analyzeFn;
      this.map = /* @__PURE__ */ new Map();
      this.stats = { hits: 0, misses: 0, computes: 0 };
    }
    key(audio, options) {
      return `${fingerprint(audio.samples, audio.sampleRate, audio.durationSeconds)}|${optionsKey(options)}`;
    }
    /**
     * Return the BeatGrid for `audio`, using the cache when enabled.
     * @returns {{ grid:object, cached:boolean }}
     */
    analyze(audio, options = {}) {
      if (!this.enabled) {
        this.stats.computes++;
        return { grid: this.analyzeFn(audio, options), cached: false };
      }
      const k = this.key(audio, options);
      if (this.map.has(k)) {
        const grid2 = this.map.get(k);
        this.map.delete(k);
        this.map.set(k, grid2);
        this.stats.hits++;
        return { grid: grid2, cached: true };
      }
      this.stats.misses++;
      this.stats.computes++;
      const grid = this.analyzeFn(audio, options);
      this.store(k, grid);
      return { grid, cached: false };
    }
    store(key, grid) {
      this.map.set(key, grid);
      while (this.map.size > this.maxEntries) {
        const oldest = this.map.keys().next().value;
        this.map.delete(oldest);
      }
    }
    clear() {
      this.map.clear();
      this.stats = { hits: 0, misses: 0, computes: 0 };
    }
  };

  // src/ui/panel.js
  var $ = (id) => document.getElementById(id);
  var seqInfo = null;
  var currentGrid = null;
  var rangeStartSeconds = 0;
  var cancelFlag = false;
  var lastSamples = null;
  var lastSampleRate = 0;
  var settings = new SettingsStore(localStorageBackend());
  var analyzer = new Analyzer();
  function localStorageBackend() {
    try {
      if (typeof localStorage !== "undefined") return localStorage;
    } catch {
    }
    return memoryBackend();
  }
  function presetPath() {
    return settings.get("pcmWavPreset") || "";
  }
  function status(msg, kind = "") {
    const bar = $("statusBar");
    bar.textContent = msg || "";
    bar.className = `statusbar ${kind}`;
  }
  function showProgress(on, label = "Analyzing audio\u2026") {
    $("progress").classList.toggle("hidden", !on);
    if (on) {
      $("progressLabel").textContent = label;
      setProgress(0);
    }
  }
  function setProgress(p2) {
    $("progressFill").style.width = `${Math.round(p2 * 100)}%`;
  }
  function toggleSource() {
    const isFile = document.querySelector('input[name="source"]:checked').value === "file";
    $("fileSource").classList.toggle("hidden", !isFile);
    $("timelineSource").classList.toggle("hidden", isFile);
  }
  function toggleBpmMode() {
    const manual = $("bpmMode").value === "manual";
    $("manualBpm").classList.toggle("hidden", !manual);
    $("analyzeBtn").textContent = manual ? "BUILD GRID" : "ANALYZE";
  }
  async function refreshTimeline() {
    if (!isUxp()) {
      status("Preview mode \u2014 open in Premiere Pro to read the timeline.", "");
      return;
    }
    try {
      seqInfo = await readSequenceInfo();
      $("sequenceSelect").innerHTML = `<option>${seqInfo.name ?? "Active Sequence"}</option>`;
      const tracks = await listAudioTracks();
      const trackSel = $("trackSelect");
      trackSel.disabled = false;
      trackSel.innerHTML = tracks.map((t) => `<option value="${t.index}">${t.label}${t.name ? ` \u2014 ${t.name}` : ""}</option>`).join("");
      status(`Sequence: ${seqInfo.nominalFps} fps${seqInfo.dropFrame ? " DF" : ""}, ${tracks.length} audio track(s).`, "ok");
    } catch (e) {
      status(toBeatMarkerError(e).userMessage, "error");
    }
  }
  function selectedMeter() {
    const m = $("meterSelect").value;
    return m === "auto" ? "4/4" : m;
  }
  function analyzeOptions() {
    return {
      minBpm: 60,
      maxBpm: 200,
      sensitivity: Number($("sensitivity").value) / 100,
      meterHint: $("meterSelect").value,
      onProgress: (p2) => setProgress(0.1 + 0.85 * p2),
      isCancelled: () => cancelFlag
    };
  }
  function renderResult() {
    if (!currentGrid) return;
    const meter = currentGrid.meter;
    const bars = Math.max(1, Math.ceil(currentGrid.beats.length / beatsPerBar(meter)));
    $("result").classList.remove("hidden");
    $("rBpm").textContent = String(currentGrid.bpm);
    $("rMeter").textContent = meter;
    $("rConf").textContent = `${Math.round(currentGrid.confidence * 100)}%`;
    $("rDur").textContent = seqInfo ? formatDuration(seqInfo.durationSeconds) : "\u2014";
    $("rBeats").textContent = String(currentGrid.beats.length);
    $("rBars").textContent = String(bars);
    if (seqInfo) {
      const abs = currentGrid.firstBeat + rangeStartSeconds + offsetSeconds();
      const frame = secondsToFrames(abs, seqInfo) + seqInfo.zeroPointTicks / seqInfo.ticksPerFrame;
      $("firstBeatTc").textContent = framesToTimecode(frame, seqInfo, seqInfo.dropFrame);
    }
  }
  function initSettings() {
    settings.load();
    analyzer.enabled = settings.get("cacheEnabled");
    setDevMode(settings.get("devMode"));
    applySettingsToUI();
  }
  function applySettingsToUI() {
    $("sensitivity").value = String(settings.get("sensitivity"));
    $("markerMode").value = settings.get("defaultMarkerMode");
    $("meterSelect").value = settings.get("defaultMeter");
    $("offsetMs").value = String(settings.get("firstBeatOffsetMs"));
    $("presetPath").value = settings.get("pcmWavPreset");
    $("cacheEnabled").checked = settings.get("cacheEnabled");
    $("keepTemp").checked = settings.get("keepTemp");
    $("devMode").checked = settings.get("devMode");
    const bpm = settings.get("defaultBpm");
    if (bpm !== "auto") {
      $("bpmMode").value = "manual";
      $("manualBpm").value = String(bpm);
      toggleBpmMode();
    }
  }
  function saveSettingsFromUI() {
    settings.set({
      sensitivity: Number($("sensitivity").value),
      defaultMarkerMode: $("markerMode").value,
      defaultMeter: $("meterSelect").value,
      firstBeatOffsetMs: Number($("offsetMs").value || 0),
      pcmWavPreset: $("presetPath").value.trim(),
      cacheEnabled: $("cacheEnabled").checked,
      keepTemp: $("keepTemp").checked,
      devMode: $("devMode").checked
    });
    analyzer.enabled = settings.get("cacheEnabled");
    setDevMode(settings.get("devMode"));
  }
  function setWaveform(samples, sampleRate) {
    lastSamples = samples;
    lastSampleRate = sampleRate;
    drawWaveform();
  }
  function hideWaveform() {
    lastSamples = null;
    $("waveformSection").classList.add("hidden");
  }
  function drawWaveform() {
    const cv = $("waveform");
    if (!cv || !lastSamples || lastSamples.length === 0) return hideWaveform();
    $("waveformSection").classList.remove("hidden");
    const w = Math.max(1, cv.clientWidth || 300);
    const h = 80;
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    const { mins, maxs } = computePeaks(lastSamples, w);
    ctx.strokeStyle = "#6f6f78";
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      ctx.moveTo(x + 0.5, mid - maxs[x] * mid);
      ctx.lineTo(x + 0.5, mid - mins[x] * mid);
    }
    ctx.stroke();
    const dur = lastSamples.length / lastSampleRate;
    if (currentGrid && dur > 0) {
      for (const b of currentGrid.beats) {
        const x = Math.round(b.time / dur * w);
        if (x < 0 || x > w) continue;
        ctx.strokeStyle = b.type === "downbeat" ? "#e0533d" : b.type === "strong" ? "#e6c84a" : "#46c26a";
        ctx.globalAlpha = b.type === "beat" ? 0.5 : 0.9;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  async function onAnalyze() {
    const source = document.querySelector('input[name="source"]:checked').value;
    if ($("bpmMode").value === "manual") return buildManualGrid();
    if (source === "file") return status('Use "Choose File" to load and analyze an audio file.', "");
    return analyzeTimeline();
  }
  function buildManualGrid() {
    if (!seqInfo) return status("Open a sequence in Premiere Pro first.", "error");
    const bpm = Number($("manualBpm").value);
    if (!(bpm > 0)) return status("Enter a valid Manual BPM.", "error");
    currentGrid = buildGridFromBpm({
      bpm,
      firstBeat: 0,
      durationSeconds: seqInfo.durationSeconds,
      meter: selectedMeter(),
      confidence: 1
    });
    rangeStartSeconds = 0;
    hideWaveform();
    renderResult();
    status(`Built ${currentGrid.beats.length} beats at ${bpm} BPM.`, "ok");
  }
  async function analyzeTimeline() {
    if (!isUxp()) return status("Open in Premiere Pro to analyze the timeline.", "");
    if (!seqInfo) return status("Open a sequence first.", "error");
    if (!presetPath()) {
      return status("Timeline analysis needs a PCM WAV export preset (.epr). Set one in Settings.", "error");
    }
    const mode = $("extractMode").value === "mix" ? "mix" : "perClip";
    cancelFlag = false;
    showProgress(true, mode === "mix" ? "Rendering sequence mix\u2026" : "Rendering track clips\u2026");
    try {
      const rendered = await renderTimelineAudio({
        mode,
        trackIndex: Number($("trackSelect").value || 0),
        presetPath: presetPath(),
        onProgress: (p2) => setProgress(0.05 + 0.05 * p2),
        isCancelled: () => cancelFlag
      });
      const opts = analyzeOptions();
      let audio;
      if (rendered.mode === "mix") {
        audio = decodeWav(rendered.buffer);
        rangeStartSeconds = 0;
      } else {
        const decoded = rendered.clips.map((c) => {
          const w = decodeWav(c.buffer);
          return { startSeconds: c.startSeconds, samples: w.samples, sampleRate: w.sampleRate };
        });
        const asm = assembleTrackAudio(decoded);
        audio = { samples: asm.samples, sampleRate: asm.sampleRate };
        rangeStartSeconds = asm.rangeStartSeconds;
      }
      const { grid, cached } = analyzer.analyze(audio, opts);
      currentGrid = grid;
      setWaveform(audio.samples, audio.sampleRate);
      renderResult();
      status(`Analyzed: ${grid.bpm} BPM, ${grid.beats.length} beats${cached ? " (cached)" : ""}.`, "ok");
    } catch (e) {
      if (e && e.cancelled) status("Analysis cancelled.", "");
      else status(toBeatMarkerError(e).userMessage, "error");
    } finally {
      showProgress(false);
      if (!settings.get("keepTemp")) await cleanup().catch(() => {
      });
    }
  }
  async function onChooseFile() {
    if (!isUxp()) return status("Open in Premiere Pro to choose a file.", "");
    cancelFlag = false;
    try {
      const picked = await pickAudioFile();
      if (!picked) return;
      $("fileInfo").classList.remove("hidden");
      $("fileInfo").textContent = `File: ${picked.name} \xB7 ${(picked.sizeBytes / 1048576).toFixed(1)} MB`;
      if (picked.ext === "mp3") {
        return status("MP3 decoding needs the native/WASM engine (not yet built). Use WAV for now.", "error");
      }
      showProgress(true, "Analyzing audio\u2026");
      const w = decodeWav(picked.buffer);
      const { grid, cached } = analyzer.analyze({ samples: w.samples, sampleRate: w.sampleRate, durationSeconds: w.durationSeconds }, analyzeOptions());
      currentGrid = grid;
      rangeStartSeconds = 0;
      setWaveform(w.samples, w.sampleRate);
      $("fileInfo").textContent += ` \xB7 ${formatDuration(w.durationSeconds)}`;
      renderResult();
      status(`Analyzed ${picked.name}: ${grid.bpm} BPM${cached ? " (cached)" : ""}.`, "ok");
    } catch (e) {
      status(toBeatMarkerError(e).userMessage, "error");
    } finally {
      showProgress(false);
    }
  }
  function offsetSeconds() {
    return Number($("offsetMs").value || 0) / 1e3;
  }
  function onSetFirstBeat() {
    if (!currentGrid || !seqInfo) return status("Build or analyze a grid first.", "");
    renderResult();
    const off = offsetSeconds();
    status(off ? `First beat offset: ${off * 1e3} ms.` : "First beat offset cleared.", "");
  }
  function allowedMarkerTypes() {
    const set = /* @__PURE__ */ new Set();
    if ($("mAll").checked) set.add("beat");
    if ($("mStrong").checked) set.add("strong");
    if ($("mDown").checked) set.add("downbeat");
    return set;
  }
  async function onCreateMarkers() {
    if (!isUxp()) return status("Open in Premiere Pro to create markers.", "");
    if (!currentGrid || !seqInfo) return status("Build or analyze a grid first.", "error");
    const allowed = allowedMarkerTypes();
    if (allowed.size === 0) return status("Select at least one beat type (All / Strong / Downbeats).", "");
    try {
      const placements = computePlacements(currentGrid, $("markerMode").value, seqInfo, {
        rangeStartSeconds,
        extraOffsetSeconds: offsetSeconds()
      }).filter((p2) => allowed.has(p2.beat.type));
      if (placements.length === 0) return status("No markers to create for this mode/type/range.", "");
      const n = await createMarkers(placements);
      status(`Created ${n} marker(s).`, "ok");
    } catch (e) {
      status(toBeatMarkerError(e).userMessage, "error");
    }
  }
  async function onDeleteMarkers() {
    if (!isUxp()) return status("Open in Premiere Pro to manage markers.", "");
    try {
      const n = await deleteGeneratedMarkers();
      status(n > 0 ? `Deleted ${n} Beat Marker marker(s).` : "No Beat Marker markers found.", "ok");
    } catch (e) {
      status(toBeatMarkerError(e).userMessage, "error");
    }
  }
  function onCancel() {
    cancelFlag = true;
    status("Cancelling\u2026", "");
  }
  async function onExportGrid() {
    if (!currentGrid) return status("Build or analyze a grid first.", "error");
    const format = $("exportFormat").value;
    const opts = { seqInfo, rangeStartSeconds, extraOffsetSeconds: offsetSeconds() };
    const text = format === "csv" ? gridToCSV(currentGrid, opts) : gridToJSON(currentGrid, opts);
    if (!isUxp()) return status("Open in Premiere Pro to save the export.", "");
    try {
      const saved = await saveTextFile(text, `beatgrid.${format}`);
      status(saved ? `Beat grid exported (${format.toUpperCase()}).` : "Export cancelled.", saved ? "ok" : "");
    } catch (e) {
      status(toBeatMarkerError(e).userMessage, "error");
    }
  }
  function wire() {
    document.querySelectorAll('input[name="source"]').forEach((r) => r.addEventListener("change", toggleSource));
    $("bpmMode").addEventListener("change", toggleBpmMode);
    $("analyzeBtn").addEventListener("click", onAnalyze);
    $("createMarkers").addEventListener("click", onCreateMarkers);
    $("deleteMarkers").addEventListener("click", onDeleteMarkers);
    $("setFirstBeat").addEventListener("click", onSetFirstBeat);
    $("chooseFile").addEventListener("click", onChooseFile);
    $("cancelBtn").addEventListener("click", onCancel);
    $("exportGrid").addEventListener("click", onExportGrid);
    ["sensitivity", "markerMode", "meterSelect", "offsetMs", "presetPath", "cacheEnabled", "keepTemp", "devMode"].forEach(
      (id) => $(id).addEventListener("change", saveSettingsFromUI)
    );
    $("clearCache").addEventListener("click", () => {
      analyzer.clear();
      status("Analysis cache cleared.", "ok");
    });
    window.addEventListener("resize", () => {
      if (lastSamples) drawWaveform();
    });
    initSettings();
    toggleSource();
    toggleBpmMode();
    refreshTimeline();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
