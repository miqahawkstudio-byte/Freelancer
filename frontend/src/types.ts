export interface SubtitleSettings {
  language: string;
  maxWordsPerLine: number;
  maxLinesPerBlock: number;
  maxCharsPerLine: number;
  maxSegmentDuration: number;
  modelSize: string;
}

export type JobStatus = "idle" | "uploading" | "queued" | "transcribing" | "generating" | "done" | "error";

export interface Job {
  id: string;
  status: JobStatus;
  detectedLanguage?: string;
  duration?: number;
  error?: string;
}

export const LANGUAGES = [
  { code: "auto", label: "Wykryj automatycznie" },
  { code: "pl", label: "Polski" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" },
  { code: "uk", label: "Українська" },
  { code: "cs", label: "Čeština" },
  { code: "sk", label: "Slovenčina" },
  { code: "nl", label: "Nederlands" },
  { code: "tr", label: "Türkçe" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "العربية" },
];

export const MODEL_SIZES = [
  { code: "tiny", label: "Tiny – najszybszy, mniej dokładny" },
  { code: "base", label: "Base – szybki, dobra dokładność" },
  { code: "small", label: "Small – zalecany (balans)" },
  { code: "medium", label: "Medium – dokładniejszy, wolniejszy" },
  { code: "large-v3", label: "Large v3 – najdokładniejszy" },
];
