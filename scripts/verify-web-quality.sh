#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/apps/web"

cd "$ROOT_DIR"

echo "[1/7] Auditing shipped surfaces for placeholder/scaffold content"
if grep -RInE "Workout export scaffold|api_key=demo-key|This uses a dev scaffold flow now" apps/web/app apps/web/components; then
  echo "Quality audit failed: placeholder or scaffold content is still present in shipped web surfaces."
  exit 1
fi

echo "[2/7] Auditing app code for TODO/FIXME markers"
if grep -RInE "TODO|FIXME" apps/web/app apps/web/components apps/web/lib apps/worker | grep -v "tests/"; then
  echo "Quality audit failed: TODO/FIXME markers remain in app or worker code."
  exit 1
fi

echo "[3/7] Running web regression suite"
npm test -w apps/web

echo "[4/7] Running focused worker regression suite"
python3 -m pytest apps/worker/tests/test_worker.py apps/worker/tests/test_intervals_dashboard_state.py -q

echo "[5/7] Running web typecheck"
npm run typecheck -w apps/web

echo "[6/7] Building production web bundle"
npm run build -w apps/web

echo "[7/7] Quality verification complete"
echo "Web + worker checks passed, build succeeded, and placeholder audit is clean."
