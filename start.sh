#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Backend ──────────────────────────────────────────────────────────────────
echo "[1/3] Instalowanie zależności backendu..."
cd "$ROOT/backend"
pip install -q -r requirements.txt

echo "[2/3] Uruchamianie backendu (port 8000)..."
uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# ── Frontend ─────────────────────────────────────────────────────────────────
echo "[3/3] Instalowanie i uruchamianie frontendu (port 5173)..."
cd "$ROOT/frontend"
npm install -q
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "================================================"
echo " SRT Generator uruchomiony!"
echo " Otwórz:  http://localhost:5173"
echo " API:     http://localhost:8000/docs"
echo "================================================"
echo ""
echo "Naciśnij Ctrl+C aby zatrzymać."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
