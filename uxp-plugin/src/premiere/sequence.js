/**
 * Warstwa dostępu do Premiere Pro (UXP DOM).
 *
 * Jedyne miejsce, które importuje 'premierepro' — dzięki temu reszta aplikacji
 * jest niezależna od API Adobe (i testowalna). Używamy wyłącznie
 * udokumentowanych metod UXP (zweryfikowane w oficjalnej referencji):
 *
 *   Project.getActiveProject()            -> Promise<Project>        (static, 25.6+)
 *   project.getActiveSequence()           -> Promise<Sequence>
 *   sequence.name                         -> string
 *   sequence.getAudioTrackCount()         -> Promise<number>
 *   sequence.getAudioTrack(index)         -> Promise<AudioTrack>
 *   sequence.getInPoint()/getOutPoint()   -> Promise<TickTime>
 *   sequence.getZeroPoint()/getEndTime()  -> Promise<TickTime>
 *   sequence.getTimebase()                -> Promise<string>  (ticks/klatkę)
 *   audioTrack.name / getIndex() / isMuted() / getTrackItems(type, includeEmpty)
 *
 * ETAP 3: odczyt aktywnej sekwencji, ścieżek audio i zakresu timeline.
 * ETAP 6 wykorzysta zwracane pola sekundowe do offsetu timecode.
 */

import { createLogger } from "../utils/logger.js";
import { AppError, ErrorCodes } from "../utils/errors.js";
import { fpsFromTimebase, secondsOf } from "./timecode.js";

const log = createLogger("premiere");

/**
 * @returns {any|null} obiekt premierepro albo null gdy poza Premiere (np. testy).
 */
export function getPPro() {
  try {
    // eslint-disable-next-line no-undef
    return require("premierepro");
  } catch (e) {
    return null;
  }
}

/**
 * Zwraca aktywny projekt lub rzuca NO_ACTIVE_SEQUENCE gdy brak.
 */
export async function getActiveProject(ppro) {
  const api = ppro || getPPro();
  if (!api) throw new AppError(ErrorCodes.NO_ACTIVE_SEQUENCE);
  const project = await api.Project.getActiveProject();
  if (!project) throw new AppError(ErrorCodes.NO_ACTIVE_SEQUENCE);
  return project;
}

/**
 * Zwraca aktywną sekwencję lub rzuca NO_ACTIVE_SEQUENCE.
 */
export async function getActiveSequence(ppro) {
  const api = ppro || getPPro();
  const project = await getActiveProject(api);
  const sequence = await project.getActiveSequence();
  if (!sequence) throw new AppError(ErrorCodes.NO_ACTIVE_SEQUENCE);
  return sequence;
}

/**
 * Sprawdza, czy dana ścieżka audio zawiera jakiekolwiek klipy.
 * Defensywnie — gdy API/konstans niedostępne, zwraca null (stan nieznany),
 * aby nie blokować UI. Twarda walidacja klipów następuje przy eksporcie (Etap 4).
 * @returns {Promise<boolean|null>}
 */
async function trackHasClips(api, track) {
  try {
    const clipType = api?.Constants?.TrackItemType?.CLIP;
    if (clipType === undefined) return null;
    const items = await track.getTrackItems(clipType, false);
    return Array.isArray(items) ? items.length > 0 : null;
  } catch (e) {
    log.debug("trackHasClips: nie udało się odczytać klipów", { error: String(e && e.message) });
    return null;
  }
}

/**
 * Zbiera listę ścieżek audio sekwencji.
 * @returns {Promise<{index:number,name:string,muted:boolean|null,hasClips:boolean|null}[]>}
 */
export async function listAudioTracks(sequence, ppro) {
  const api = ppro || getPPro();
  const count = await sequence.getAudioTrackCount();
  const tracks = [];
  for (let i = 0; i < count; i++) {
    let track;
    try {
      track = await sequence.getAudioTrack(i);
    } catch (e) {
      log.warn("Nie udało się pobrać ścieżki audio", { index: i });
      continue;
    }
    let index = i;
    try {
      const idx = await track.getIndex();
      if (typeof idx === "number") index = idx;
    } catch (e) {
      /* zostaje i */
    }
    let muted = null;
    try {
      muted = await track.isMuted();
    } catch (e) {
      /* nieznane */
    }
    const hasClips = await trackHasClips(api, track);
    const name = track.name || `A${index + 1}`;
    tracks.push({ index, name, muted, hasClips });
  }
  return tracks;
}

/**
 * Pełny opis aktywnej sekwencji na potrzeby UI i dalszych etapów.
 * Zwraca też wartości sekundowe (in/out/zero/end) do obliczeń offsetu timecode.
 *
 * @returns {Promise<{
 *   available:boolean, name:string, fps:number, timebase:string,
 *   zeroPointSec:number, inPointSec:number, outPointSec:number,
 *   endSec:number, hasInOut:boolean,
 *   audioTracks:{index:number,name:string,muted:boolean|null,hasClips:boolean|null}[]
 * }>}
 */
export async function describeActiveSequence() {
  const api = getPPro();
  if (!api) {
    return {
      available: false,
      name: "(poza Premiere Pro)",
      fps: 0,
      timebase: "",
      zeroPointSec: 0,
      inPointSec: 0,
      outPointSec: 0,
      endSec: 0,
      hasInOut: false,
      audioTracks: [],
    };
  }

  const sequence = await getActiveSequence(api);

  const [timebase, zeroPt, inPt, outPt, endPt] = await Promise.all([
    safe(() => sequence.getTimebase(), ""),
    safe(() => sequence.getZeroPoint(), null),
    safe(() => sequence.getInPoint(), null),
    safe(() => sequence.getOutPoint(), null),
    safe(() => sequence.getEndTime(), null),
  ]);

  const zeroPointSec = secondsOf(zeroPt);
  const inPointSec = secondsOf(inPt);
  const outPointSec = secondsOf(outPt);
  const endSec = secondsOf(endPt);

  // In/Out uznajemy za ustawione, gdy tworzą niepusty zakres węższy niż całość.
  const hasInOut = outPointSec > inPointSec && (inPointSec > zeroPointSec || outPointSec < endSec);

  const audioTracks = await listAudioTracks(sequence, api);

  const info = {
    available: true,
    name: sequence.name || "(bez nazwy)",
    fps: fpsFromTimebase(timebase),
    timebase: String(timebase || ""),
    zeroPointSec,
    inPointSec,
    outPointSec,
    endSec,
    hasInOut,
    audioTracks,
  };

  log.debug("describeActiveSequence", {
    name: info.name,
    fps: info.fps,
    tracks: audioTracks.length,
    hasInOut,
  });

  return info;
}

/**
 * Izoluje jedną ścieżkę audio na czas eksportu (wycisza pozostałe), bo
 * exportSequence renderuje cały mix sekwencji — nie pojedynczą ścieżkę.
 * Zwraca funkcję przywracającą oryginalne stany wyciszenia.
 *
 * @param {any} sequence
 * @param {number} keepIndex  indeks (getIndex) ścieżki do zachowania; null = bez zmian
 * @returns {Promise<() => Promise<void>>} restore()
 */
export async function soloAudioTrack(sequence, keepIndex) {
  if (keepIndex == null) return async () => {};
  const count = await sequence.getAudioTrackCount();
  const saved = [];
  for (let i = 0; i < count; i++) {
    let track;
    try {
      track = await sequence.getAudioTrack(i);
    } catch (e) {
      continue;
    }
    let idx = i;
    try {
      const gi = await track.getIndex();
      if (typeof gi === "number") idx = gi;
    } catch (e) {
      /* zostaje i */
    }
    let wasMuted = false;
    try {
      wasMuted = await track.isMuted();
    } catch (e) {
      /* zakładamy false */
    }
    saved.push({ track, wasMuted });
    const shouldMute = idx !== keepIndex;
    if (shouldMute !== wasMuted) {
      try {
        await track.setMute(shouldMute);
      } catch (e) {
        log.warn("Nie udało się zmienić wyciszenia ścieżki", { idx });
      }
    }
  }
  return async () => {
    for (const { track, wasMuted } of saved) {
      try {
        await track.setMute(wasMuted);
      } catch (e) {
        /* best-effort */
      }
    }
  };
}

/**
 * Uruchamia funkcję i zwraca fallback zamiast rzucać (do zbierania metadanych).
 */
async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (e) {
    return fallback;
  }
}
