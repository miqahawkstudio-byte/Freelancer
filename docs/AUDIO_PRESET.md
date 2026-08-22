# Preset eksportu audio (.epr) — jak utworzyć

Plugin pozyskuje audio z sekwencji przez **oficjalny eksport Premiere Pro**
(`EncoderManager.exportSequence`) z presetem audio-only. UXP nie pozwala odczytać
surowego PCM ścieżki, a Adobe nie udostępnia sposobu wygenerowania poprawnego
pliku `.epr` z kodu — dlatego preset tworzysz **jednorazowo** w Premiere i
wskazujesz jego ścieżkę w Ustawieniach pluginu.

## Krok po kroku

1. W Premiere Pro: **File → Export → Media…** (z aktywną dowolną sekwencją).
2. **Format:** wybierz format audio-only, np. **Waveform Audio (WAV)**.
   (Może być też QuickTime z wyłączonym wideo — ważne, aby wynik był plikiem audio.)
3. W ustawieniach eksportu upewnij się, że:
   - **Export Video** = wyłączone (jeśli format na to pozwala),
   - **Export Audio** = włączone.
   - Dowolna częstotliwość próbkowania jest OK (backend i tak przepróbkuje;
     Whisper pracuje na 16 kHz mono, konwersja następuje po stronie backendu).
4. Kliknij ikonę **Save Preset** (dyskietka) obok listy presetów, nadaj nazwę,
   np. `PSAI WAV audio-only`.
5. Znajdź zapisany plik `.epr`:
   - **Windows:** `C:\Users\<user>\Documents\Adobe\Premiere Pro\<wersja>\Profile-<user>\Settings\EncoderPresets\...`
     (lub `...\AppData\Roaming\Adobe\Common\...` w zależności od wersji)
   - **macOS:** `~/Documents/Adobe/Premiere Pro/<wersja>/Profile-<user>/Settings/EncoderPresets/...`
   - Najprościej: możesz też **wyeksportować preset** z panelu presetów
     (Export Preset) do znanej lokalizacji.
6. Skopiuj pełną ścieżkę do pliku `.epr` i wklej ją w pluginie:
   **Ustawienia napisów → Preset eksportu audio (.epr)**.

## Uwagi

- Zakres **In/Out**: gdy w pluginie wybierzesz „Zakres In/Out", eksportowany jest
  tylko fragment między punktami In i Out sekwencji (`exportFull = false`).
- Eksport działa w trybie **IMMEDIATELY** (synchronicznie w Premiere, bez
  uruchamiania Adobe Media Encoder) — plik jest gotowy zaraz po zakończeniu.
- Plik WAV trafia do folderu tymczasowego pluginu (lub do folderu eksportu z
  Ustawień) i jest przekazywany do lokalnego backendu STT. Audio nie opuszcza
  komputera.
