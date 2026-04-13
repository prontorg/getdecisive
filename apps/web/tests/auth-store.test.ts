import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyIntervalsCredentialsRecord, loginWithPasswordRecord, registerUserWithInviteRecord, validateInviteCodeRecord } from '../lib/server/auth-store';
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
