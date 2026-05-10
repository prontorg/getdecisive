#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLANNER_BASE_URL="${PLANNER_BASE_URL:-http://127.0.0.1:3001}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://decisive.coach}"

extract_first_match() {
  local kind="$1"
  local html="$2"
  python3 - "$kind" "$html" <<'PY'
import re, sys
kind = sys.argv[1]
html = sys.argv[2]
patterns = {
    'css': r'(/_next/static/css/[^"\']+\.css)',
    'layout_js': r'(/_next/static/chunks/app/layout-[^"\']+\.js)',
}
pattern = patterns[kind]
match = re.search(pattern, html)
if not match:
    raise SystemExit(1)
print(match.group(1))
PY
}

fetch_and_assert() {
  local url="$1"
  local expect_fragment="$2"
  python3 - "$url" "$expect_fragment" <<'PY'
import sys, requests
url, expect = sys.argv[1], sys.argv[2]
response = requests.get(url, timeout=20)
if response.status_code != 200:
    raise SystemExit(f"State check failed: {url} returned {response.status_code}")
text = response.text
if 'Bad Request' in text:
    raise SystemExit(f"State check failed: {url} returned Bad Request body")
if expect and expect not in text:
    raise SystemExit(f"State check failed: {url} missing expected fragment {expect!r}")
print(f"ok {url}")
PY
}

echo "[1/6] Checking decisive-planner service state"
systemctl --user is-active decisive-planner.service | grep -qx active

echo "[2/6] Checking port 3001 listener"
ss -ltnp '( sport = :3001 )' | grep -q '127.0.0.1:3001'

echo "[3/6] Checking local login shell"
LOCAL_LOGIN_HTML="$(curl -fsS "$PLANNER_BASE_URL/login")"
[[ "$LOCAL_LOGIN_HTML" == *"Get decisive"* || "$LOCAL_LOGIN_HTML" == *"GET DECISIVE"* ]]
[[ "$LOCAL_LOGIN_HTML" != *"Application error"* ]]
LOCAL_CSS_PATH="$(extract_first_match css "$LOCAL_LOGIN_HTML")"
fetch_and_assert "$PLANNER_BASE_URL$LOCAL_CSS_PATH" ':root'


echo "[4/6] Checking public login shell"
PUBLIC_LOGIN_HTML="$(curl -fsS "$PUBLIC_BASE_URL/login")"
[[ "$PUBLIC_LOGIN_HTML" == *"Get decisive"* || "$PUBLIC_LOGIN_HTML" == *"GET DECISIVE"* ]]
[[ "$PUBLIC_LOGIN_HTML" != *"Application error"* ]]
PUBLIC_CSS_PATH="$(extract_first_match css "$PUBLIC_LOGIN_HTML")"
fetch_and_assert "$PUBLIC_BASE_URL$PUBLIC_CSS_PATH" ':root'


echo "[5/6] Running public chunk smoke"
"$ROOT_DIR/scripts/smoke-public-web.py" "$PUBLIC_BASE_URL"

echo "[6/6] Platform state looks healthy"
