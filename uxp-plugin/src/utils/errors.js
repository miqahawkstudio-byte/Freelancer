/**
 * Błędy domenowe pluginu.
 *
 * Każdy błąd ma:
 *  - code:      stabilny identyfikator (do mapowania na komunikat i logi),
 *  - userMessage: przyjazny komunikat dla montażysty (bez stack trace),
 *  - cause:     opcjonalny oryginalny błąd (tylko do logów developerskich).
 *
 * UI pokazuje userMessage; szczegóły techniczne trafiają wyłącznie do logów.
 */

export const ErrorCodes = {
  NO_ACTIVE_SEQUENCE: "NO_ACTIVE_SEQUENCE",
  NO_AUDIO_TRACKS: "NO_AUDIO_TRACKS",
  NO_CLIPS_ON_TRACK: "NO_CLIPS_ON_TRACK",
  EMPTY_RANGE: "EMPTY_RANGE",
  AUDIO_EXPORT_FAILED: "AUDIO_EXPORT_FAILED",
  BACKEND_UNREACHABLE: "BACKEND_UNREACHABLE",
  MODEL_UNAVAILABLE: "MODEL_UNAVAILABLE",
  TRANSCRIPTION_CANCELLED: "TRANSCRIPTION_CANCELLED",
  TRANSCRIPTION_FAILED: "TRANSCRIPTION_FAILED",
  DISK_FULL: "DISK_FULL",
  SRT_WRITE_FAILED: "SRT_WRITE_FAILED",
  UNSUPPORTED_FORMAT: "UNSUPPORTED_FORMAT",
  CAPTION_API_UNAVAILABLE: "CAPTION_API_UNAVAILABLE",
  UNKNOWN: "UNKNOWN",
};

const USER_MESSAGES = {
  [ErrorCodes.NO_ACTIVE_SEQUENCE]: "Brak otwartej sekwencji. Otwórz sekwencję w Premiere Pro.",
  [ErrorCodes.NO_AUDIO_TRACKS]: "Sekwencja nie zawiera ścieżek audio.",
  [ErrorCodes.NO_CLIPS_ON_TRACK]: "Wybrana ścieżka audio nie zawiera klipów.",
  [ErrorCodes.EMPTY_RANGE]: "Wybrany zakres jest pusty. Ustaw punkty In/Out lub wybierz całą sekwencję.",
  [ErrorCodes.AUDIO_EXPORT_FAILED]: "Nie udało się wyeksportować audio z sekwencji.",
  [ErrorCodes.BACKEND_UNREACHABLE]: "Brak połączenia z lokalnym silnikiem transkrypcji. Uruchom backend i sprawdź adres w ustawieniach.",
  [ErrorCodes.MODEL_UNAVAILABLE]: "Wybrany model transkrypcji jest niedostępny.",
  [ErrorCodes.TRANSCRIPTION_CANCELLED]: "Transkrypcja została przerwana.",
  [ErrorCodes.TRANSCRIPTION_FAILED]: "Transkrypcja nie powiodła się.",
  [ErrorCodes.DISK_FULL]: "Brak miejsca na dysku, aby zapisać pliki.",
  [ErrorCodes.SRT_WRITE_FAILED]: "Nie udało się zapisać pliku SRT.",
  [ErrorCodes.UNSUPPORTED_FORMAT]: "Nieobsługiwany format pliku.",
  [ErrorCodes.CAPTION_API_UNAVAILABLE]: "Tworzenie napisów w Premiere nie jest dostępne w tej wersji — zapisano plik SRT do importu.",
  [ErrorCodes.UNKNOWN]: "Wystąpił nieoczekiwany błąd.",
};

export class AppError extends Error {
  constructor(code, { cause, userMessage, details } = {}) {
    const msg = userMessage || USER_MESSAGES[code] || USER_MESSAGES[ErrorCodes.UNKNOWN];
    super(msg);
    this.name = "AppError";
    this.code = code in USER_MESSAGES ? code : ErrorCodes.UNKNOWN;
    this.userMessage = msg;
    this.details = details;
    if (cause) this.cause = cause;
  }
}

export function userMessageFor(code) {
  return USER_MESSAGES[code] || USER_MESSAGES[ErrorCodes.UNKNOWN];
}
