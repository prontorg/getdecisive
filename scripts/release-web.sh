#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/apps/web"
PLANNER_BASE_URL="${PLANNER_BASE_URL:-http://127.0.0.1:3001}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://decisive.coach}"

cd "$WEB_DIR"

echo "[1/7] Running full web quality verification"
"$ROOT_DIR/scripts/verify-web-quality.sh"

echo "[2/7] Restarting decisive-planner service"
systemctl --user restart decisive-planner.service
systemctl --user is-active decisive-planner.service

echo "[3/7] Restarting decisive-dashboard service"
systemctl --user restart decisive-dashboard.service
systemctl --user is-active decisive-dashboard.service

echo "[4/7] Checking planner health endpoint"
for attempt in $(seq 1 20); do
  if curl -fsS "$PLANNER_BASE_URL/api/health" >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 20 ]; then
    echo "Planner health check failed after restart"
    exit 1
  fi
  sleep 1
done

echo "[5/7] Running local login smoke check"
curl -fsS "$PLANNER_BASE_URL/login" | grep -q "Get decisive"
curl -fsS "$PLANNER_BASE_URL/login" | grep -qv "Application error"

echo "[6/7] Running public smoke check"
"$ROOT_DIR/scripts/smoke-public-web.py" "$PUBLIC_BASE_URL"

echo "[7/7] Release verification and restart completed successfully."
