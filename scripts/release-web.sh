#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/apps/web"

cd "$WEB_DIR"

echo "[1/4] Running web regression suite"
npm test

echo "[2/4] Running typecheck"
npm run typecheck

echo "[3/4] Building production bundle"
npm run build

echo "[4/4] Restarting decisive-planner service"
systemctl --user restart decisive-planner.service
systemctl --user is-active decisive-planner.service

echo "Release verification and restart completed successfully."
