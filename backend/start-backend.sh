#!/usr/bin/env bash
# Polish Subtitle AI - uruchomienie lokalnego backendu STT (macOS/Linux)
# Wymaga Pythona 3.10+.
set -e
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "[BLAD] Nie znaleziono python3. Zainstaluj Python 3.10+ (np. brew install python)."
  exit 1
fi

if [ ! -d ".venv" ]; then
  echo "Tworzenie środowiska wirtualnego..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

echo "Instalacja zależności (pierwsze uruchomienie może chwilę potrwać)..."
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo
echo "Uruchamianie backendu na http://127.0.0.1:8000  (zatrzymanie: Ctrl+C)"
echo "Pierwsza transkrypcja pobierze model Whisper (jednorazowo)."
echo
exec python -m uvicorn main:app --host 127.0.0.1 --port 8000
