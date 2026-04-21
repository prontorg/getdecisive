import test from 'node:test';
import assert from 'node:assert/strict';

import { buildClearSessionCookieOptions, buildSessionCookieOptions } from '../lib/server/session';

test('session cookies are secure on https requests', () => {
  const options = buildSessionCookieOptions(new Request('https://app.decisive.coach/login'), { value: 'user_1' });

  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.secure, true);
  assert.equal(options.path, '/');
  assert.equal(options.value, 'user_1');
  assert.equal(options.maxAge > 0, true);
});

test('logout cookies clear the session immediately', () => {
  const options = buildClearSessionCookieOptions(new Request('https://app.decisive.coach/logout'));

  assert.equal(options.value, '');
  assert.equal(options.maxAge, 0);
  assert.equal(options.secure, true);
  assert.equal(options.expires?.getTime(), 0);
});
