/**
 * timelineAnalyze.js — orchestrates decode -> assemble -> analyze for the
 * timeline source. Host-agnostic: it takes already-rendered WAV buffers (the
 * Premiere encoder produces those; see premiere/AudioExtractor.js) so it stays
 * unit-testable without Premiere.
 */

import { decodeWav } from '../audio/WaveReader.js';
import { assembleTrackAudio } from './timelineAssemble.js';
import { analyzeAudio } from './index.js';

/**
 * Analyze a set of per-clip WAV buffers laid out on the timeline.
 *
 * @param {Array<{ startSeconds:number, buffer:(Uint8Array|ArrayBuffer) }>} clips
 *        each buffer is the rendered on-timeline segment of one clip
 * @param {Object} [options] analyze options (minBpm, maxBpm, sensitivity, ...)
 *        plus optional { targetRate }
 * @returns {{ grid:import('../beatGrid/BeatGrid.js').BeatGrid, rangeStartSeconds:number,
 *            gaps:Array<[number,number]>, sampleRate:number }}
 */
export function analyzeClipBuffers(clips, options = {}) {
  const decoded = clips.map((c) => {
    const w = decodeWav(c.buffer);
    return { startSeconds: c.startSeconds, samples: w.samples, sampleRate: w.sampleRate };
  });
  const asm = assembleTrackAudio(decoded, { targetRate: options.targetRate });
  const grid = analyzeAudio({ samples: asm.samples, sampleRate: asm.sampleRate }, options);
  return { grid, rangeStartSeconds: asm.rangeStartSeconds, gaps: asm.gaps, sampleRate: asm.sampleRate };
}

/**
 * Analyze a single rendered WAV buffer (used by the whole-sequence-mix mode and
 * by the direct Audio File source).
 *
 * @param {Uint8Array|ArrayBuffer} buffer
 * @param {Object} [options]
 * @returns {{ grid:import('../beatGrid/BeatGrid.js').BeatGrid, sampleRate:number, durationSeconds:number }}
 */
export function analyzeWavBuffer(buffer, options = {}) {
  const w = decodeWav(buffer);
  const grid = analyzeAudio({ samples: w.samples, sampleRate: w.sampleRate }, options);
  return { grid, sampleRate: w.sampleRate, durationSeconds: w.durationSeconds };
}
