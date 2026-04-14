import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import LoginPage from '../app/login/page';
import { GET as logoutGet, POST as logoutPost } from '../app/api/auth/logout/route';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sessionCookieName } from '../lib/server/session';

test('login page renders a minimal login card without signed-out banner by default', async () => {
  const element = await LoginPage({ searchParams: Promise.resolve({ notice: 'Signed out' }) });
  const html = renderToStaticMarkup(element);

  assert.match(html, /Get decisive/i);
  assert.doesNotMatch(html, /Signed out/i);
  assert.doesNotMatch(html, /Create account/i);
  assert.doesNotMatch(html, /Access decisive/i);
  assert.match(html, /action="\/api\/auth\/login"/i);
});

test('login page only shows create account when invite code is present', async () => {
  const element = await LoginPage({ searchParams: Promise.resolve({ inviteCode: 'DECISIVE-INVITE' }) });
  const html = renderToStaticMarkup(element);

  assert.match(html, /Create account/i);
  assert.match(html, /href="\/register\?inviteCode=DECISIVE-INVITE"/i);
});

test('logout rejects GET and redirects back to login with a signed-out notice on POST', async () => {
  const getResponse = await logoutGet();
  assert.equal(getResponse.status, 405);

  const response = await logoutPost(new Request('https://app.decisive.coach/api/auth/logout', { method: 'POST' }));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'https://app.decisive.coach/login?notice=Signed+out');
  const setCookie = response.headers.get('set-cookie') || '';
  assert.match(setCookie, new RegExp(`${sessionCookieName}=`, 'i'));
  assert.match(setCookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/i);
});

test('landing page defaults to login when no session exists', async () => {
  const source = await readFile(join(process.cwd(), 'app/page.tsx'), 'utf8');

  assert.match(source, /redirect\(userId \? '\/app\/dashboard' : '\/login'\)/i);
});
