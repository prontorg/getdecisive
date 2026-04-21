import test from 'node:test';
import assert from 'node:assert/strict';

import { GET as logoutGet, POST as logoutPost } from '../app/api/auth/logout/route';
import { sessionCookieName } from '../lib/server/session';

test('logout GET redirects back to login without clearing the session', async () => {
  const response = await logoutGet(new Request('https://decisive.coach/api/auth/logout'));

  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'https://decisive.coach/login?notice=Use+the+in-app+logout+button');
  assert.equal(response.headers.get('set-cookie'), null);
});

test('logout POST redirects back to login with a signed-out notice and clears the session', async () => {
  const response = await logoutPost(new Request('https://decisive.coach/api/auth/logout', { method: 'POST' }));

  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'https://decisive.coach/login?notice=Signed+out');
  const setCookie = response.headers.get('set-cookie') || '';
  assert.match(setCookie, new RegExp(`${sessionCookieName}=`, 'i'));
  assert.match(setCookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/i);
});
