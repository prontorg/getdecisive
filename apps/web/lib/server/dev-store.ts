import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  createSeedPlatformState,
  type PlatformState,
} from './platform-state';

function getStorePath(): string {
  return join(process.cwd(), '.decisive-dev-store.json');
}

function getBackupPath(storePath: string): string {
  return `${storePath}.bak`;
}

async function writeStateFile(path: string, state: PlatformState): Promise<void> {
  const tmpPath = `${path}.tmp`;
  const payload = JSON.stringify(state, null, 2);
  await writeFile(tmpPath, payload);
  await rename(tmpPath, path);
}

async function ensureStoreFile(): Promise<void> {
  const storePath = getStorePath();
  await mkdir(dirname(storePath), { recursive: true });
  try {
    const raw = await readFile(storePath, 'utf8');
    if (raw.trim()) return;
  } catch {
    // fall through to create the seed file
  }
  await writeStateFile(storePath, createSeedPlatformState());
}

export async function loadPlatformState(): Promise<PlatformState> {
  const storePath = getStorePath();
  await ensureStoreFile();
  const raw = await readFile(storePath, 'utf8');
  try {
    return JSON.parse(raw) as PlatformState;
  } catch {
    try {
      const backupRaw = await readFile(getBackupPath(storePath), 'utf8');
      return JSON.parse(backupRaw) as PlatformState;
    } catch {
      const seed = createSeedPlatformState();
      await savePlatformState(seed);
      return seed;
    }
  }
}

export async function savePlatformState(state: PlatformState): Promise<void> {
  const storePath = getStorePath();
  await ensureStoreFile();
  await writeStateFile(storePath, state);
  await writeFile(getBackupPath(storePath), JSON.stringify(state, null, 2));
}
