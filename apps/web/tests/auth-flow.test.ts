import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { NextRequest } from 'next/server';

import { middleware } from '../middleware';
import { POST as loginPost } from '../app/api/auth/login/route';
import { registerUserWithInviteRecord } from '../lib/server/auth-store';
import { sessionCookieName } from '../lib/server/session';

function requestWithCookie(url: string, cookie?: string) {
  const headers = cookie ? { cookie } : undefined;
  return new NextRequest(url, { headers });
}

test('middleware redirects the root path to login when there is no session', () => {
  const response = middleware(requestWithCookie('https://decisive.coach/'));

  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'https://decisive.coach/login');
});

test('middleware redirects login to dashboard when a session exists', () => {
  const response = middleware(requestWithCookie('https://decisive.coach/login', `${sessionCookieName}=user_1`));

  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'https://decisive.coach/app/dashboard');
});

test('login route sets the session cookie and redirects authenticated users forward', async () => {
  const previousDb = process.env.DATABASE_URL;
  const previousStore = process.env.DECISIVE_PLATFORM_STORE_PATH;
  const dir = await mkdtemp(join(tmpdir(), 'auth-flow-'));
  process.env.DECISIVE_PLATFORM_STORE_PATH = join(dir, 'store.json');
  delete process.env.DATABASE_URL;

  try {
    const email = `athlete-${Date.now()}@example.com`;
    await registerUserWithInviteRecord({ inviteCode: 'DECISIVE-INVITE', email, password: 'secret123', displayName: 'Athlete' });

    const formData = new FormData();
    formData.set('email', email);
    formData.set('password', 'secret123');
    const response = await loginPost(new Request('https://decisive.coach/api/auth/login', { method: 'POST', body: formData }));

    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), 'https://decisive.coach/onboarding/sync-status');
    const setCookie = response.headers.get('set-cookie') || '';
    assert.match(setCookie, new RegExp(`${sessionCookieName}=`, 'i'));
  } finally {
    if (previousDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDb;
    if (previousStore === undefined) delete process.env.DECISIVE_PLATFORM_STORE_PATH; else process.env.DECISIVE_PLATFORM_STORE_PATH = previousStore;
    await rm(dir, { recursive: true, force: true });
  }
});
