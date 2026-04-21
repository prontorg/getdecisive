import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createManagedUserRecord,
  deleteManagedUserRecord,
  listManagedUsersRecord,
  updateManagedUserRecord,
  upsertManagedUserIntervalsConnectionRecord,
} from '../lib/server/auth-store';
import { loadPlatformState, savePlatformState } from '../lib/server/dev-store';
import { loginWithPasswordRecord } from '../lib/server/auth-store';

async function withFileStore(run: (dir: string) => Promise<void>) {
  const previousDb = process.env.DATABASE_URL;
  const previousStore = process.env.DECISIVE_PLATFORM_STORE_PATH;
  const dir = await mkdtemp(join(tmpdir(), 'admin-user-management-'));
  process.env.DECISIVE_PLATFORM_STORE_PATH = join(dir, 'store.json');
  delete process.env.DATABASE_URL;
  try {
    await run(dir);
  } finally {
    if (previousDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDb;
    if (previousStore === undefined) delete process.env.DECISIVE_PLATFORM_STORE_PATH; else process.env.DECISIVE_PLATFORM_STORE_PATH = previousStore;
    await rm(dir, { recursive: true, force: true });
  }
}

test('admin can create, update, list, and delete managed users in file fallback mode', async () => {
  await withFileStore(async () => {
    const created = await createManagedUserRecord('admin_user', {
      email: 'rider@example.com',
      displayName: 'Track Rider',
      password: 'secret123',
      roles: ['athlete'],
    });

    assert.equal(created.user.email, 'rider@example.com');
    assert.equal(created.membership.roles.includes('athlete'), true);

    const listed = await listManagedUsersRecord();
    assert.equal(listed.length, 1);

    const updated = await updateManagedUserRecord(created.user.id, {
      displayName: 'Updated Rider',
      password: 'nextsecret123',
      roles: ['athlete', 'coach'],
    });
    assert.equal(updated.user.displayName, 'Updated Rider');
    assert.equal(updated.membership.roles.includes('coach'), true);

    const login = await loginWithPasswordRecord('rider@example.com', 'nextsecret123');
    assert.equal(login?.id, created.user.id);

    await deleteManagedUserRecord(created.user.id);
    const state = await loadPlatformState();
    assert.equal(state.users.some((user) => user.id === created.user.id), false);
  });
});

test('managed user intervals settings are stored on the target user and keep user-scoped ids separate', async () => {
  await withFileStore(async () => {
    const riderA = await createManagedUserRecord('admin_user', {
      email: 'rider-a@example.com',
      displayName: 'Rider A',
      password: 'secret123',
      roles: ['athlete'],
    });
    const riderB = await createManagedUserRecord('admin_user', {
      email: 'rider-b@example.com',
      displayName: 'Rider B',
      password: 'secret123',
      roles: ['athlete'],
    });

    const connectionA = await upsertManagedUserIntervalsConnectionRecord(riderA.user.id, {
      athleteId: '17634020',
      credentialPayload: 'api_key=a',
      connectionLabel: 'A account',
    });
    const connectionB = await upsertManagedUserIntervalsConnectionRecord(riderB.user.id, {
      athleteId: '998877',
      credentialPayload: 'api_key=b',
      connectionLabel: 'B account',
    });

    assert.equal(connectionA.userId, riderA.user.id);
    assert.equal(connectionB.userId, riderB.user.id);

    const state = await loadPlatformState();
    assert.equal(state.intervalsConnections.filter((item) => item.userId === riderA.user.id)[0]?.externalAthleteId, '17634020');
    assert.equal(state.intervalsConnections.filter((item) => item.userId === riderB.user.id)[0]?.externalAthleteId, '998877');
  });
});

test('cannot remove the last admin role from the only admin user', async () => {
  await withFileStore(async () => {
    const admin = await createManagedUserRecord('admin_user', {
      email: 'admin@example.com',
      displayName: 'Admin User',
      password: 'secret123',
      roles: ['admin'],
    });
    const state = await loadPlatformState();
    state.memberships.find((membership) => membership.userId === admin.user.id)!.roles = ['admin'];
    await savePlatformState(state);

    await assert.rejects(
      () => updateManagedUserRecord(admin.user.id, { roles: ['athlete'] }),
      /At least one admin must remain/i,
    );
  });
});
