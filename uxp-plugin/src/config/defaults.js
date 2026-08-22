/**
 * Domyślne ustawienia pluginu Polish Subtitle AI.
 *
 * Wartości są konfigurowalne w UI i zapisywane trwale (patrz config/settings.js).
 * Ten plik jest jednym źródłem prawdy dla wartości domyślnych — używany także
 * przy pierwszym uruchomieniu i przy resetowaniu ustawień.
 */

export const DEFAULT_SETTINGS = {
  // --- Silnik STT ---
  sttModel: "large-v3", // faster-whisper: tiny | base | small | medium | large-v3
  language: "pl",

  // --- Backend ---
  backendUrl: "http://127.0.0.1:8000",

  // --- Segmentacja / łamanie linii ---
  maxCharsPerLine: 42,
  maxLines: 2,
  // Preferowany zakres znaków na linię (czytelność) — segmentacja stara się w nim zmieścić.
  preferredMinChars: 32,
  preferredMaxChars: 42,

  // --- Czas trwania napisu (ms) ---
  minDurationMs: 1000,
  maxDurationMs: 7000,

  // --- Post-processing ---
  autoPunctuation: true, // automatyczna interpunkcja
  smartSentenceSplit: true, // inteligentny podział zdań
  removeRepetitions: true, // usuwanie zbędnych powtórzeń
  aiCorrection: false, // opcjonalna korekta AI/LLM (domyślnie wyłączona)

  // --- Eksport ---
  exportFolder: "", // pusty = obok projektu / wybór przez użytkownika

  // --- Developer ---
  devLogging: false,
};

/**
 * Metadane pól ustawień — używane przez UI do budowania formularza i walidacji.
 * Trzymane osobno, aby DEFAULT_SETTINGS pozostało czystym obiektem wartości.
 */
export const SETTINGS_SCHEMA = {
  sttModel: { type: "enum", options: ["tiny", "base", "small", "medium", "large-v3"], label: "Model" },
  language: { type: "enum", options: ["pl"], label: "Język" },
  maxCharsPerLine: { type: "int", min: 20, max: 60, label: "Maks. znaków / linia" },
  maxLines: { type: "int", min: 1, max: 3, label: "Maks. liczba linii" },
  minDurationMs: { type: "int", min: 200, max: 5000, label: "Minimalny czas napisu (ms)" },
  maxDurationMs: { type: "int", min: 2000, max: 15000, label: "Maksymalny czas napisu (ms)" },
  autoPunctuation: { type: "bool", label: "Automatyczna interpunkcja" },
  smartSentenceSplit: { type: "bool", label: "Inteligentny podział zdań" },
  removeRepetitions: { type: "bool", label: "Usuwanie zbędnych powtórzeń" },
  aiCorrection: { type: "bool", label: "Korekta AI (opcjonalna)" },
};
