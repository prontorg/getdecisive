import test from 'node:test';
import assert from 'node:assert/strict';

import {
  changeUserPassword,
  createSeedPlatformState,
  loginWithPassword,
  registerUserWithInvite,
} from '../lib/server/platform-state';
import { hashPassword, verifyPassword } from '../lib/server/auth-password';

test('hashPassword produces a non-plaintext value that still verifies', () => {
  const hashed = hashPassword('secret123');

  assert.notEqual(hashed, 'secret123');
  assert.equal(verifyPassword('secret123', hashed), true);
  assert.equal(verifyPassword('wrong', hashed), false);
});

test('registerUserWithInvite stores a hashed password and login still works', () => {
  const state = createSeedPlatformState();

  const registration = registerUserWithInvite(state, {
    inviteCode: 'DECISIVE-INVITE',
    email: 'athlete@example.com',
    password: 'secret123',
    displayName: 'Athlete',
  });

  assert.notEqual(registration.user.password, 'secret123');
  assert.equal(loginWithPassword(state, 'athlete@example.com', 'secret123')?.id, registration.user.id);
});

test('changeUserPassword verifies the current password and stores the next password hashed', () => {
  const state = createSeedPlatformState();
  const registration = registerUserWithInvite(state, {
    inviteCode: 'DECISIVE-INVITE',
    email: 'athlete@example.com',
    password: 'secret123',
    displayName: 'Athlete',
  });

  const user = changeUserPassword(state, registration.user.id, 'secret123', 'new-secret');

  assert.notEqual(user.password, 'new-secret');
  assert.equal(loginWithPassword(state, 'athlete@example.com', 'new-secret')?.id, registration.user.id);
  assert.equal(loginWithPassword(state, 'athlete@example.com', 'secret123'), null);
});
