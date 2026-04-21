import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  applyIntervalsCredentialsRecord,
  createInviteRecord,
  enqueueIntervalsRefreshOnLogin,
  listInviteRecords,
  loginWithPasswordRecord,
  registerUserWithInviteRecord,
  revokeInviteRecord,
  validateInviteCodeRecord,
} from '../lib/server/auth-store';
import { loadPlatformState } from '../lib/server/dev-store';

test('validateInviteCodeRecord uses file fallback when DATABASE_URL is absent', async () => {
  const previousDb = process.env.DATABASE_URL;
  const previousStore = process.env.DECISIVE_PLATFORM_STORE_PATH;
  const dir = await mkdtemp(join(tmpdir(), 'auth-store-'));
  process.env.DECISIVE_PLATFORM_STORE_PATH = join(dir, 'store.json');
  delete process.env.DATABASE_URL;
  try {
    const result = await validateInviteCodeRecord('DECISIVE-INVITE');
    assert.equal(result.valid, true);
  } finally {
    if (previousDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDb;
    if (previousStore === undefined) delete process.env.DECISIVE_PLATFORM_STORE_PATH; else process.env.DECISIVE_PLATFORM_STORE_PATH = previousStore;
    await rm(dir, { recursive: true, force: true });
  }
});

test('registerUserWithInviteRecord and loginWithPasswordRecord use file fallback when DATABASE_URL is absent', async () => {
  const previousDb = process.env.DATABASE_URL;
  const previousStore = process.env.DECISIVE_PLATFORM_STORE_PATH;
  const dir = await mkdtemp(join(tmpdir(), 'auth-store-'));
  process.env.DECISIVE_PLATFORM_STORE_PATH = join(dir, 'store.json');
  delete process.env.DATABASE_URL;
  try {
    const email = `athlete-${Date.now()}@example.com`;
    const registration = await registerUserWithInviteRecord({ inviteCode: 'DECISIVE-INVITE', email, password: 'secret123', displayName: 'Athlete' });
    const user = await loginWithPasswordRecord(email, 'secret123');
    assert.equal(user?.id, registration.user.id);
  } finally {
    if (previousDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDb;
    if (previousStore === undefined) delete process.env.DECISIVE_PLATFORM_STORE_PATH; else process.env.DECISIVE_PLATFORM_STORE_PATH = previousStore;
    await rm(dir, { recursive: true, force: true });
  }
});

test('applyIntervalsCredentialsRecord creates a queued sync job in file fallback mode', async () => {
  const previousDb = process.env.DATABASE_URL;
  const previousStore = process.env.DECISIVE_PLATFORM_STORE_PATH;
  const dir = await mkdtemp(join(tmpdir(), 'auth-store-'));
  process.env.DECISIVE_PLATFORM_STORE_PATH = join(dir, 'store.json');
  delete process.env.DATABASE_URL;
  try {
    const email = `athlete-${Date.now()}@example.com`;
    const registration = await registerUserWithInviteRecord({ inviteCode: 'DECISIVE-INVITE', email, password: 'secret123', displayName: 'Athlete' });
    await applyIntervalsCredentialsRecord(registration.user.id, { athleteId: '17634020', credentialPayload: 'api_key=xyz', connectionLabel: 'Primary' });
    const state = await loadPlatformState();
    assert.equal(state.syncJobs.length, 1);
    assert.equal(state.syncJobs[0]?.jobType, 'intervals_initial_sync');
  } finally {
    if (previousDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDb;
    if (previousStore === undefined) delete process.env.DECISIVE_PLATFORM_STORE_PATH; else process.env.DECISIVE_PLATFORM_STORE_PATH = previousStore;
    await rm(dir, { recursive: true, force: true });
  }
});

test('enqueueIntervalsRefreshOnLogin creates a queued incremental sync job without clearing the latest snapshot', async () => {
  const previousDb = process.env.DATABASE_URL;
  const previousStore = process.env.DECISIVE_PLATFORM_STORE_PATH;
  const dir = await mkdtemp(join(tmpdir(), 'auth-store-'));
  process.env.DECISIVE_PLATFORM_STORE_PATH = join(dir, 'store.json');
  delete process.env.DATABASE_URL;
  try {
    const email = `athlete-${Date.now()}@example.com`;
    const registration = await registerUserWithInviteRecord({ inviteCode: 'DECISIVE-INVITE', email, password: 'secret123', displayName: 'Athlete' });
    await applyIntervalsCredentialsRecord(registration.user.id, { athleteId: '17634020', credentialPayload: 'api_key=xyz', connectionLabel: 'Primary' });
    const state = await loadPlatformState();
    const connectionId = state.intervalsConnections[0]?.id;
    assert.ok(connectionId);
    state.syncJobs[0].status = 'completed';
    state.syncJobs[0].updatedAt = '2026-04-14T08:00:00Z';
    state.intervalsConnections[0].syncStatus = 'ready';
    state.intervalsSnapshots.push({
      id: 'snap_1',
      userId: registration.user.id,
      connectionId,
      sourceJobId: state.syncJobs[0].id,
      capturedAt: '2026-04-14T08:05:00Z',
      liveState: { today: '2026-04-14', athlete_id: '17634020', today_plan: 'Z2 endurance', tomorrow_plan: '6x4 min @ 410-420 W' },
    });
    await import('../lib/server/dev-store').then(({ savePlatformState }) => savePlatformState(state));

    const queued = await enqueueIntervalsRefreshOnLogin(registration.user.id);
    const updated = await loadPlatformState();

    assert.equal(queued, true);
    assert.equal(updated.syncJobs.length, 2);
    assert.equal(updated.syncJobs[1]?.jobType, 'intervals_incremental_sync');
    assert.equal(updated.syncJobs[1]?.status, 'queued');
    assert.equal(updated.intervalsSnapshots.length, 1);
    assert.equal(updated.intervalsConnections[0]?.syncStatus, 'ready');
  } finally {
    if (previousDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDb;
    if (previousStore === undefined) delete process.env.DECISIVE_PLATFORM_STORE_PATH; else process.env.DECISIVE_PLATFORM_STORE_PATH = previousStore;
    await rm(dir, { recursive: true, force: true });
  }
});

test('createInviteRecord, listInviteRecords, and revokeInviteRecord work in file fallback mode', async () => {
  const previousDb = process.env.DATABASE_URL;
  const previousStore = process.env.DECISIVE_PLATFORM_STORE_PATH;
  const dir = await mkdtemp(join(tmpdir(), 'auth-store-'));
  process.env.DECISIVE_PLATFORM_STORE_PATH = join(dir, 'store.json');
  delete process.env.DATABASE_URL;
  try {
    const registration = await registerUserWithInviteRecord({
      inviteCode: 'DECISIVE-INVITE',
      email: `admin-${Date.now()}@example.com`,
      password: 'secret123',
      displayName: 'Admin',
    });
    const state = await loadPlatformState();
    state.memberships[0].roles = ['admin'];
    await import('../lib/server/dev-store').then(({ savePlatformState }) => savePlatformState(state));

    const invite = await createInviteRecord(registration.user.id, { code: 'BETA-2026', maxUses: 3 });
    assert.equal(invite.code, 'BETA-2026');
    const invites = await listInviteRecords();
    assert.equal(invites.some((item) => item.code === 'BETA-2026'), true);

    const revoked = await revokeInviteRecord(registration.user.id, invite.id);
    assert.equal(revoked.status, 'revoked');
    const updated = await listInviteRecords();
    assert.equal(updated.find((item) => item.id === invite.id)?.status, 'revoked');
  } finally {
    if (previousDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDb;
    if (previousStore === undefined) delete process.env.DECISIVE_PLATFORM_STORE_PATH; else process.env.DECISIVE_PLATFORM_STORE_PATH = previousStore;
    await rm(dir, { recursive: true, force: true });
  }
});
