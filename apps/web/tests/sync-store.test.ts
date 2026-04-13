import test from 'node:test';
import assert from 'node:assert/strict';

import { getLatestSnapshotForUser, getLatestSyncJobForUser } from '../lib/server/sync-store';

test('getLatestSyncJobForUser uses fallback jobs when DATABASE_URL is absent', async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const job = await getLatestSyncJobForUser('user_1', [
    { id: 'job_1', userId: 'user_1', connectionId: 'conn_1', jobType: 'intervals_initial_sync', status: 'queued', progressPct: 25, statusMessage: 'Queued', updatedAt: '2026-04-13T00:00:00Z' },
    { id: 'job_2', userId: 'user_1', connectionId: 'conn_1', jobType: 'intervals_incremental_sync', status: 'running', progressPct: 50, statusMessage: 'Running', updatedAt: '2026-04-13T01:00:00Z' },
  ]);
  assert.equal(job?.id, 'job_2');
  if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
});

test('getLatestSnapshotForUser uses fallback snapshots when DATABASE_URL is absent', async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const snapshot = await getLatestSnapshotForUser('user_1', 'conn_1', [
    { id: 'snap_1', userId: 'user_1', connectionId: 'conn_1', sourceJobId: 'job_1', capturedAt: '2026-04-13T00:00:00Z', liveState: { today: '2026-04-13', athlete_id: '1' } },
    { id: 'snap_2', userId: 'user_1', connectionId: 'conn_1', sourceJobId: 'job_2', capturedAt: '2026-04-13T01:00:00Z', liveState: { today: '2026-04-13', athlete_id: '2' } },
  ]);
  assert.equal(snapshot?.id, 'snap_2');
  if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
});
