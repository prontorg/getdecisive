#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[fast 1/4] Auditing shipped surfaces for placeholder/scaffold content"
if grep -RInE "Workout export scaffold|api_key=demo-key|This uses a dev scaffold flow now" apps/web/app apps/web/components; then
  echo "Fast quality audit failed: placeholder or scaffold content is still present in shipped web surfaces."
  exit 1
fi

echo "[fast 2/4] Auditing app code for TODO/FIXME markers"
if grep -RInE "TODO|FIXME" apps/web/app apps/web/components apps/web/lib apps/worker | grep -v "tests/"; then
  echo "Fast quality audit failed: TODO/FIXME markers remain in app or worker code."
  exit 1
fi

echo "[fast 3/4] Running web typecheck"
npm run typecheck -w apps/web

echo "[fast 4/4] Running focused reliability regression suite"
npm test -w apps/web -- app-header.test.ts login-page.test.ts logout-route.test.ts device-location-route.test.ts ui-copy-and-layout.test.ts monthly-planner-replan-route.test.ts planning-store.test.ts

echo "Fast verification passed."
