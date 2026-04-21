import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

import { enqueueIntervalsRefreshOnLogin, getPlatformState } from '../apps/web/lib/server/auth-store.ts';

const execFileAsync = promisify(execFile);

function repoRoot() {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
}

function workerPath() {
  return path.join(repoRoot(), 'apps', 'worker', 'main.py');
}

async function runWorkerUntilQueueDrains(storePath?: string) {
  const processedResults: unknown[] = [];
  while (true) {
    try {
      const { stdout } = await execFileAsync('python3', [workerPath(), 'run-next', ...(storePath ? ['--store-path', storePath] : [])], {
        cwd: repoRoot(),
        env: {
          ...process.env,
          ...(storePath ? { DECISIVE_PLATFORM_STORE_PATH: storePath } : {}),
        },
      });
      processedResults.push(JSON.parse(stdout || '{}'));
    } catch (error: any) {
      const stdout = String(error?.stdout || '').trim();
      const parsed = stdout ? JSON.parse(stdout) : null;
      if (parsed?.reason === 'no_sync_jobs') {
        return processedResults;
      }
      throw error;
    }
  }
}

async function main() {
  const state = await getPlatformState();
  const readyUserIds = [...new Set(
    state.intervalsConnections
      .filter((connection) => connection.syncStatus === 'ready')
      .map((connection) => connection.userId),
  )];

  const queuedUsers: string[] = [];
  for (const userId of readyUserIds) {
    const queued = await enqueueIntervalsRefreshOnLogin(userId, 'Scheduled shared snapshot refresh queued');
    if (queued) queuedUsers.push(userId);
  }

  const results = await runWorkerUntilQueueDrains(process.env.DECISIVE_PLATFORM_STORE_PATH);
  console.log(JSON.stringify({
    readyUserIds,
    queuedUsers,
    processedJobs: results.length,
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
