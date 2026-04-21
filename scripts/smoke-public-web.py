#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from urllib.parse import urljoin

import requests

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else 'https://decisive.coach'
TIMEOUT = 20
SESSION = requests.Session()


def fetch(path: str) -> requests.Response:
    response = SESSION.get(urljoin(BASE_URL, path), timeout=TIMEOUT)
    response.raise_for_status()
    return response


def ensure(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


login = fetch('/login')
login_html = login.text
ensure('Application error' not in login_html, 'Public smoke failed: /login contains application error markup')
ensure('Get decisive' in login_html or 'GET DECISIVE' in login_html, 'Public smoke failed: /login missing decisive login copy')

layout_match = re.search(r'(/_next/static/chunks/app/layout-[^"\']+\.js)', login_html)
ensure(layout_match is not None, 'Public smoke failed: could not find app layout chunk in /login HTML')
layout_url = urljoin(BASE_URL, layout_match.group(1))
layout_response = SESSION.get(layout_url, timeout=TIMEOUT)
ensure(layout_response.status_code == 200, f'Public smoke failed: layout chunk returned {layout_response.status_code} for {layout_url}')
ensure('Bad Request' not in layout_response.text, 'Public smoke failed: layout chunk body returned Bad Request page')

root = fetch('/')
root_html = root.text
ensure('Application error' not in root_html, 'Public smoke failed: root path contains application error markup')

print('Public smoke passed for', BASE_URL)
print('Layout chunk:', layout_url)
