import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createSeedPlatformState } from '../lib/server/platform-state';
import { loadPlatformState, savePlatformState } from '../lib/server/dev-store';

test('loadPlatformState restores the last good backup when the store is truncated', async () => {
  const cwd = process.cwd();
  const dir = await mkdtemp(join(tmpdir(), 'decisive-dev-store-'));
  process.chdir(dir);

  try {
    const state = createSeedPlatformState();
    state.users.push({
      id: 'user_test',
      email: 'athlete@example.com',
      displayName: 'Athlete',
      password: 'hashed',
      workspaceId: 'workspace_test',
    });

    await savePlatformState(state);

    state.users[0]!.displayName = 'Updated Tobias';
    await savePlatformState(state);

    await writeFile(join(dir, '.decisive-dev-store.json'), '{');

    const recovered = await loadPlatformState();
    assert.equal(recovered.users[0]?.displayName, 'Updated Tobias');
    assert.equal(recovered.users.some((user) => user.email === 'athlete@example.com'), true);
  } finally {
    process.chdir(cwd);
  }
});

test('savePlatformState writes atomically without leaving an empty store file', async () => {
  const cwd = process.cwd();
  const dir = await mkdtemp(join(tmpdir(), 'decisive-dev-store-'));
  process.chdir(dir);

  try {
    const state = createSeedPlatformState();
    await savePlatformState(state);

    const raw = await readFile(join(dir, '.decisive-dev-store.json'), 'utf8');
    assert.equal(raw.trim().startsWith('{'), true);
    assert.equal(raw.includes('invites'), true);
  } finally {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadPlatformState honors DECISIVE_PLATFORM_STORE_PATH for shared worker access', async () => {
  const cwd = process.cwd();
  const dir = await mkdtemp(join(tmpdir(), 'decisive-dev-store-env-'));
  const storePath = join(dir, 'shared-store.json');
  const previous = process.env.DECISIVE_PLATFORM_STORE_PATH;
  process.chdir(dir);
  process.env.DECISIVE_PLATFORM_STORE_PATH = storePath;

  try {
    const state = createSeedPlatformState();
    await savePlatformState(state);

    const raw = await readFile(storePath, 'utf8');
    const loaded = await loadPlatformState();

    assert.equal(raw.includes('DECISIVE-INVITE'), true);
    assert.equal(loaded.invites[0]?.code, 'DECISIVE-INVITE');
  } finally {
    if (previous === undefined) {
      delete process.env.DECISIVE_PLATFORM_STORE_PATH;
    } else {
      process.env.DECISIVE_PLATFORM_STORE_PATH = previous;
    }
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  }
});
