@echo off
REM Polish Subtitle AI - uruchomienie lokalnego backendu STT (Windows)
REM Dwuklik lub uruchom w terminalu. Wymaga zainstalowanego Pythona 3.10+.

cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo [BLAD] Nie znaleziono Pythona. Zainstaluj Python 3.10+ z https://www.python.org/downloads/
  echo        Podczas instalacji zaznacz "Add python.exe to PATH", potem uruchom ten plik ponownie.
  pause
  exit /b 1
)

if not exist ".venv" (
  echo Tworzenie srodowiska wirtualnego...
  python -m venv .venv
)

call ".venv\Scripts\activate.bat"

echo Instalacja zaleznosci (pierwsze uruchomienie moze chwile potrwac)...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo.
echo Uruchamianie backendu na http://127.0.0.1:8000  (zatrzymanie: Ctrl+C)
echo Pierwsza transkrypcja pobierze model Whisper (jednorazowo).
echo.
python -m uvicorn main:app --host 127.0.0.1 --port 8000
pause
