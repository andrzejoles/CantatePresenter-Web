#!/usr/bin/env bash
# CantatePresenter Web — Skrypt uruchomieniowy

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "===================================================================="
echo "  Uruchamianie CantatePresenter Web na http://localhost:3000"
echo "===================================================================="

# Otwórz przeglądarkę po 1 sekundzie od startu
(sleep 1 && open "http://localhost:3000") &

# Uruchom serwer
python3 "$DIR/server.py"
