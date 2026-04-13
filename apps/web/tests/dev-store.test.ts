import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
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
  }
});
