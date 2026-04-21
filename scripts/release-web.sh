#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/apps/web"

cd "$WEB_DIR"

echo "[1/5] Running full web quality verification"
"$ROOT_DIR/scripts/verify-web-quality.sh"

echo "[2/5] Restarting decisive-planner service"
systemctl --user restart decisive-planner.service
systemctl --user is-active decisive-planner.service

echo "[3/5] Restarting decisive-dashboard service"
systemctl --user restart decisive-dashboard.service
systemctl --user is-active decisive-dashboard.service

echo "[4/6] Checking planner health endpoint"
curl -fsS http://127.0.0.1:3000/api/health >/dev/null

echo "[5/6] Running local login smoke check"
curl -fsS http://127.0.0.1:3000/login | grep -q "Get decisive"
curl -fsS http://127.0.0.1:3000/login | grep -qv "Application error"

echo "[6/6] Release verification and restart completed successfully."
