/**
 * Budowa i obsługa panelu (UI).
 *
 * ETAP 2: pełny, statyczny layout zgodny z makietą (ciemny motyw), wczytanie
 * i zapis ustawień, wykrycie środowiska Premiere. Akcje generowania są na razie
 * wyłączone i opisane etapem, w którym zostaną podłączone. Kolejne etapy
 * podpinają logikę (sekwencja, audio, STT, segmentacja, SRT).
 */

import { getSettings, setSetting, loadSettings } from "../config/settings.js";
import { describeActiveSequence, getPPro } from "../premiere/sequence.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("ui");

/** Skrót do tworzenia elementów DOM. */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) node.appendChild(c);
  return node;
}

function field(labelText, controlNode) {
  return el("div", { class: "field" }, [el("label", { text: labelText }), controlNode]);
}

function checkbox(id, labelText, checked, onChange) {
  const input = el("input", { type: "checkbox", id });
  input.checked = !!checked;
  input.addEventListener("change", () => onChange(input.checked));
  return el("label", { class: "check", for: id }, [input, document.createTextNode(labelText)]);
}

export async function renderPanel(root) {
  await loadSettings();
  const s = getSettings();
  const inPremiere = getPPro() !== null;

  // --- Nagłówek ---
  const header = el("h1", { class: "title" }, [
    document.createTextNode("POLISH SUBTITLE AI"),
    el("span", { class: "sub", text: "Automatyczne polskie napisy z timeline" }),
  ]);

  // --- Sekcja: sekwencja / źródło ---
  const seqNameValue = el("div", { class: "value", text: "…" });
  const audioSelect = el("select", { id: "audioTrack" });
  audioSelect.appendChild(el("option", { value: "", text: "—" }));

  const rangeSelect = el("select", { id: "range" });
  rangeSelect.appendChild(el("option", { value: "full", text: "Cała sekwencja" }));
  rangeSelect.appendChild(el("option", { value: "inout", text: "Zakres In/Out" }));

  const sourceSection = el("div", { class: "section" }, [
    field("Sekwencja", seqNameValue),
    el("div", { class: "field-row" }, [
      field("Ścieżka audio", audioSelect),
      field("Zakres", rangeSelect),
    ]),
  ]);

  // --- Sekcja: model / język ---
  const modelSelect = el("select", { id: "model" });
  for (const m of ["tiny", "base", "small", "medium", "large-v3"]) {
    const opt = el("option", { value: m, text: m === "large-v3" ? "Whisper large-v3 (zalecany)" : `Whisper ${m}` });
    if (m === s.sttModel) opt.selected = true;
    modelSelect.appendChild(opt);
  }
  modelSelect.addEventListener("change", () => setSetting("sttModel", modelSelect.value));

  const langValue = el("div", { class: "value", text: "Polski" });

  const modelSection = el("div", { class: "section" }, [
    el("div", { class: "field-row" }, [field("Model", modelSelect), field("Język", langValue)]),
  ]);

  // --- Sekcja: ustawienia napisów ---
  const maxChars = el("input", { type: "number", id: "maxChars", min: "20", max: "60" });
  maxChars.value = s.maxCharsPerLine;
  maxChars.addEventListener("change", () => setSetting("maxCharsPerLine", clampInt(maxChars, 20, 60)));

  const maxLines = el("input", { type: "number", id: "maxLines", min: "1", max: "3" });
  maxLines.value = s.maxLines;
  maxLines.addEventListener("change", () => setSetting("maxLines", clampInt(maxLines, 1, 3)));

  const minDur = el("input", { type: "number", id: "minDur", min: "200", max: "5000", step: "100" });
  minDur.value = s.minDurationMs;
  minDur.addEventListener("change", () => setSetting("minDurationMs", clampInt(minDur, 200, 5000)));

  const maxDur = el("input", { type: "number", id: "maxDur", min: "2000", max: "15000", step: "100" });
  maxDur.value = s.maxDurationMs;
  maxDur.addEventListener("change", () => setSetting("maxDurationMs", clampInt(maxDur, 2000, 15000)));

  const subtitleSection = el("details", { class: "settings section" }, [
    el("summary", { text: "Ustawienia napisów" }),
    el("div", { class: "field-row" }, [
      field("Maks. znaków / linia", maxChars),
      field("Maks. liczba linii", maxLines),
    ]),
    el("div", { class: "field-row" }, [
      field("Min. czas (ms)", minDur),
      field("Maks. czas (ms)", maxDur),
    ]),
    el("div", { class: "divider" }),
    checkbox("optPunct", "Automatyczna interpunkcja", s.autoPunctuation, (v) => setSetting("autoPunctuation", v)),
    checkbox("optSplit", "Inteligentny podział zdań", s.smartSentenceSplit, (v) => setSetting("smartSentenceSplit", v)),
    checkbox("optRep", "Usuwanie zbędnych powtórzeń", s.removeRepetitions, (v) => setSetting("removeRepetitions", v)),
    checkbox("optAi", "Korekta AI (opcjonalna)", s.aiCorrection, (v) => setSetting("aiCorrection", v)),
  ]);

  // --- Akcja główna + progress + status ---
  const generateBtn = el("button", { class: "btn btn-primary", id: "generate", text: "GENERUJ NAPISY" });
  const cancelBtn = el("button", { class: "btn btn-danger", id: "cancel", text: "Anuluj" });
  cancelBtn.disabled = true;
  generateBtn.disabled = true; // podłączenie pipeline: kolejne etapy

  const bar = el("div", { class: "bar" });
  const progress = el("div", { class: "progress" }, [bar]);
  const status = el("div", { class: "status", id: "status", text: "" });

  const runSection = el("div", { class: "section" }, [
    el("div", { class: "actions-row" }, [generateBtn, cancelBtn]),
    field("Postęp", progress),
    field("Status", status),
  ]);

  // --- Akcje po zakończeniu ---
  const exportSrtBtn = el("button", { class: "btn", id: "exportSrt", text: "EKSPORTUJ SRT" });
  const createCaptionsBtn = el("button", { class: "btn", id: "createCaptions", text: "UTWÓRZ NAPISY W PREMIERE" });
  const openFolderBtn = el("button", { class: "btn", id: "openFolder", text: "OTWÓRZ FOLDER" });
  [exportSrtBtn, createCaptionsBtn, openFolderBtn].forEach((b) => (b.disabled = true));

  const resultSection = el("div", { class: "section actions" }, [
    exportSrtBtn,
    createCaptionsBtn,
    openFolderBtn,
  ]);

  // --- Stopka informacyjna ---
  const footer = el("div", { class: "muted" }, [
    document.createTextNode(
      inPremiere
        ? "Gotowe. Podłączanie pipeline w kolejnych etapach."
        : "Uwaga: uruchomiono poza Premiere Pro (podgląd UI)."
    ),
  ]);

  // --- Montaż ---
  root.innerHTML = "";
  [header, sourceSection, modelSection, subtitleSection, runSection, resultSection, footer].forEach((n) =>
    root.appendChild(n)
  );

  // --- Dane sekwencji (placeholder do Etapu 3) ---
  try {
    const seq = await describeActiveSequence();
    seqNameValue.textContent = seq.name;
    if (seq.audioTracks.length) {
      audioSelect.innerHTML = "";
      for (const t of seq.audioTracks) {
        audioSelect.appendChild(el("option", { value: String(t.index), text: t.name }));
      }
    }
  } catch (e) {
    setStatus(status, e.userMessage || "Nie udało się odczytać sekwencji.", "error");
    log.warn("describeActiveSequence failed", { code: e.code });
  }

  return { generateBtn, cancelBtn, bar, status, exportSrtBtn, createCaptionsBtn, openFolderBtn };
}

function clampInt(input, min, max) {
  let v = parseInt(input.value, 10);
  if (Number.isNaN(v)) v = min;
  v = Math.max(min, Math.min(max, v));
  input.value = v;
  return v;
}

export function setStatus(node, text, kind) {
  node.textContent = text || "";
  node.className = `status${kind ? " " + kind : ""}`;
}

export function setProgress(bar, percent) {
  bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}
