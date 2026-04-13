import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyIntervalsCredentials,
  createSeedPlatformState,
  loginWithPassword,
  registerUserWithInvite,
  validateInviteCode,
} from '../lib/server/platform-state';

test('validateInviteCode accepts active single-use unused codes', () => {
  const state = createSeedPlatformState();

  const result = validateInviteCode(state, 'DECISIVE-INVITE');

  assert.equal(result.valid, true);
  assert.equal(result.reason, undefined);
});

test('validateInviteCode rejects exhausted codes', () => {
  const state = createSeedPlatformState();
  registerUserWithInvite(state, {
    inviteCode: 'DECISIVE-INVITE',
    email: 'athlete@example.com',
    password: 'secret123',
    displayName: 'Athlete',
  });

  const result = validateInviteCode(state, 'DECISIVE-INVITE');

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'Invite code already used');
});

test('registerUserWithInvite creates the user, redeems invite, and starts onboarding', () => {
  const state = createSeedPlatformState();

  const registration = registerUserWithInvite(state, {
    inviteCode: 'DECISIVE-INVITE',
    email: 'athlete@example.com',
    password: 'secret123',
    displayName: 'Athlete',
  });

  assert.equal(registration.user.email, 'athlete@example.com');
  assert.equal(registration.membership.roles.includes('athlete'), true);
  assert.equal(registration.onboarding.state, 'account_created');
  assert.equal(state.invites[0].usedCount, 1);
  assert.equal(state.auditEvents.at(-1)?.eventType, 'user.registered');
});

test('loginWithPassword returns the matching user for a valid password', () => {
  const state = createSeedPlatformState();
  registerUserWithInvite(state, {
    inviteCode: 'DECISIVE-INVITE',
    email: 'athlete@example.com',
    password: 'secret123',
    displayName: 'Athlete',
  });

  const user = loginWithPassword(state, 'athlete@example.com', 'secret123');

  assert.equal(user?.email, 'athlete@example.com');
});

test('applyIntervalsCredentials moves onboarding into sync flow with progress metadata', () => {
  const state = createSeedPlatformState();
  const registration = registerUserWithInvite(state, {
    inviteCode: 'DECISIVE-INVITE',
    email: 'athlete@example.com',
    password: 'secret123',
    displayName: 'Athlete',
  });

  const onboarding = applyIntervalsCredentials(state, registration.user.id, {
    athleteId: '17634020',
    credentialPayload: 'api_key=xyz',
    connectionLabel: 'Primary account',
  });

  assert.equal(onboarding.state, 'sync_started');
  assert.equal(onboarding.progressPct, 25);
  assert.equal(state.intervalsConnections[0].externalAthleteId, '17634020');
  assert.equal(state.auditEvents.at(-1)?.eventType, 'intervals.connected');
});
