// beatmarker_engine.cpp — native Beat Marker engine (aubio + dr_wav/dr_mp3).
//
// SCAFFOLDING: uses the real aubio and dr_libs APIs, but is compiled only on a
// build machine with the toolchain + vendored third_party/ (see native/README).
// It must produce the SAME BeatGrid JSON as the pure-JS reference engine
// (src/engine/analyze.js): times in seconds relative to the analyzed audio start.
//
// Pipeline: decode -> mono float @ source rate -> aubio_tempo (onset+tempo+beat)
// -> collect beat times -> meter/downbeat by accent contrast -> JSON.

#include <string>
#include <vector>
#include <cmath>

// Vendored single-header decoders (third_party/).
#define DR_WAV_IMPLEMENTATION
#include "dr_wav.h"
#define DR_MP3_IMPLEMENTATION
#include "dr_mp3.h"

// aubio (third_party/aubio).
#include "aubio/aubio.h"

namespace {

struct AnalyzeOptions {
  double minBpm = 40.0;
  double maxBpm = 220.0;
  double manualBpm = 0.0; // >0 => skip tempo estimation
};

// Decode WAV or MP3 to interleaved-then-downmixed mono float. Returns false on
// failure. On success fills `mono` and `sampleRate`.
bool decode_to_mono(const std::string& path, std::vector<float>& mono, unsigned& sampleRate) {
  // Try WAV first.
  {
    drwav wav;
    if (drwav_init_file(&wav, path.c_str(), nullptr)) {
      sampleRate = wav.sampleRate;
      std::vector<float> inter(wav.totalPCMFrameCount * wav.channels);
      drwav_read_pcm_frames_f32(&wav, wav.totalPCMFrameCount, inter.data());
      downmix(inter, wav.channels, mono);
      drwav_uninit(&wav);
      return true;
    }
  }
  // Then MP3 (CBR/VBR handled by dr_mp3).
  {
    drmp3 mp3;
    if (drmp3_init_file(&mp3, path.c_str(), nullptr)) {
      sampleRate = mp3.sampleRate;
      drmp3_uint64 frames = drmp3_get_pcm_frame_count(&mp3);
      std::vector<float> inter(frames * mp3.channels);
      drmp3_read_pcm_frames_f32(&mp3, frames, inter.data());
      downmix(inter, mp3.channels, mono);
      drmp3_uninit(&mp3);
      return true;
    }
  }
  return false;
}

void downmix(const std::vector<float>& inter, unsigned channels, std::vector<float>& mono) {
  const size_t frames = inter.size() / channels;
  mono.resize(frames);
  for (size_t i = 0; i < frames; i++) {
    float s = 0.f;
    for (unsigned c = 0; c < channels; c++) s += inter[i * channels + c];
    mono[i] = s / channels;
  }
}

// Run aubio tempo/beat tracking; append detected beat times (seconds).
void detect_beats(const std::vector<float>& mono, unsigned sr,
                  std::vector<double>& beatTimes, double& bpmOut, double& confOut) {
  const uint_t win = 1024, hop = 512;
  aubio_tempo_t* tempo = new_aubio_tempo("default", win, hop, sr);
  fvec_t* in = new_fvec(hop);
  fvec_t* out = new_fvec(1);

  for (size_t pos = 0; pos + hop <= mono.size(); pos += hop) {
    for (uint_t i = 0; i < hop; i++) in->data[i] = mono[pos + i];
    aubio_tempo_do(tempo, in, out);
    if (out->data[0] != 0) {
      // aubio reports the last beat position in samples.
      smpl_t last = aubio_tempo_get_last_s(tempo);
      beatTimes.push_back((double)last);
    }
  }
  bpmOut = aubio_tempo_get_bpm(tempo);
  confOut = aubio_tempo_get_confidence(tempo);

  del_aubio_tempo(tempo);
  del_fvec(in);
  del_fvec(out);
}

// TODO(build-machine): meter/downbeat by accent contrast (mirror analyze.js),
// then serialize the BeatGrid JSON with the same field names/semantics.
std::string to_beatgrid_json(const std::vector<double>& beats, double bpm, double conf,
                             unsigned sr);

} // namespace

extern "C" {

// Entry point exposed to the UXP hybrid addon bridge (native/uxpaddon/).
// Returns BeatGrid JSON, or an object with an "error" field on failure.
const char* beatmarker_analyze_file(const char* path, double minBpm, double maxBpm,
                                    double manualBpm) {
  static std::string result; // NOTE: bridge copies immediately; not thread-safe by design.
  std::vector<float> mono;
  unsigned sr = 0;
  if (!decode_to_mono(path, mono, sr)) {
    result = "{\"error\":\"DECODE_FAILED\"}";
    return result.c_str();
  }
  std::vector<double> beats;
  double bpm = manualBpm, conf = 1.0;
  if (manualBpm <= 0.0) detect_beats(mono, sr, beats, bpm, conf);
  result = to_beatgrid_json(beats, bpm, conf, sr);
  return result.c_str();
}

} // extern "C"
