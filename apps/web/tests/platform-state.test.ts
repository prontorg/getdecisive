import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyIntervalsCredentials,
  completeIntervalsSyncJob,
  createSeedPlatformState,
  deriveOnboardingStatus,
  getLatestIntervalsSnapshot,
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
  assert.equal(state.syncJobs.length, 1);
  assert.equal(state.syncJobs[0]?.jobType, 'intervals_initial_sync');
  assert.equal(state.syncJobs[0]?.status, 'queued');
  assert.equal(state.auditEvents.at(-1)?.eventType, 'intervals.connected');
});

test('deriveOnboardingStatus waits for a persisted user snapshot before marking ready', () => {
  const state = createSeedPlatformState();
  const registration = registerUserWithInvite(state, {
    inviteCode: 'DECISIVE-INVITE',
    email: 'athlete@example.com',
    password: 'secret123',
    displayName: 'Athlete',
  });

  applyIntervalsCredentials(state, registration.user.id, {
    athleteId: '17634020',
    credentialPayload: 'api_key=xyz',
    connectionLabel: 'Primary account',
  });
  state.onboardingRuns[0]!.syncStartedAt = '2026-04-13T00:00:00Z';

  const onboarding = deriveOnboardingStatus(state, registration.user.id, new Date('2026-04-13T00:00:20Z'));

  assert.equal(onboarding?.state, 'sync_building_dashboard');
  assert.equal(onboarding?.progressPct, 88);
  assert.match(onboarding?.statusMessage || '', /user-scoped Intervals snapshot/i);
});

test('completeIntervalsSyncJob stores a user-scoped snapshot and marks the connection ready', () => {
  const state = createSeedPlatformState();
  const registration = registerUserWithInvite(state, {
    inviteCode: 'DECISIVE-INVITE',
    email: 'athlete@example.com',
    password: 'secret123',
    displayName: 'Athlete',
  });

  applyIntervalsCredentials(state, registration.user.id, {
    athleteId: '17634020',
    credentialPayload: 'api_key=xyz',
    connectionLabel: 'Primary account',
  });

  const job = state.syncJobs[0]!;
  const snapshot = completeIntervalsSyncJob(state, job.id, {
    today: '2026-04-13',
    athlete_id: '17634020',
    today_plan: 'Z2 endurance',
    tomorrow_plan: '6x4 min @ 410-420 W',
    wellness: { ctl: 107, atl: 128 },
  });

  assert.equal(snapshot.connectionId, job.connectionId);
  assert.equal(snapshot.userId, registration.user.id);
  assert.equal(snapshot.liveState.athlete_id, '17634020');
  assert.equal(state.intervalsConnections[0]?.syncStatus, 'ready');
  assert.equal(state.syncJobs[0]?.status, 'completed');
  assert.equal(state.onboardingRuns[0]?.state, 'ready');
  assert.equal(getLatestIntervalsSnapshot(state, registration.user.id)?.liveState.today, '2026-04-13');
});
