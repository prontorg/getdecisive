import type { LiveState } from './live-state';
import { loadPlatformState, savePlatformState } from './dev-store';
import { getPgPool, isPostgresSyncStoreEnabled } from './pg';
import type { IntervalsSnapshotRecord, SyncJobRecord } from './platform-state';

export type SyncStore = {
  getLatestSyncJob(userId: string): Promise<SyncJobRecord | null>;
  upsertSyncJob(job: SyncJobRecord): Promise<void>;
  getLatestSnapshot(userId: string, connectionId?: string): Promise<IntervalsSnapshotRecord | null>;
  upsertSnapshot(snapshot: IntervalsSnapshotRecord): Promise<void>;
};

function mapSyncJob(row: any): SyncJobRecord {
  return {
    id: row.id,
    userId: row.user_id,
    connectionId: row.connection_id,
    jobType: row.job_type,
    status: row.status,
    progressPct: row.progress_pct,
    statusMessage: row.status_message,
    startedAt: row.started_at?.toISOString?.() || row.started_at || undefined,
    finishedAt: row.finished_at?.toISOString?.() || row.finished_at || undefined,
    lastError: row.last_error || undefined,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function mapSnapshot(row: any): IntervalsSnapshotRecord {
  return {
    id: row.id,
    userId: row.user_id,
    connectionId: row.connection_id,
    sourceJobId: row.source_job_id,
    capturedAt: row.captured_at?.toISOString?.() || row.captured_at,
    liveState: row.live_state_json as LiveState,
  };
}

function fileSyncStore(): SyncStore {
  return {
    async getLatestSyncJob(userId) {
      const state = await loadPlatformState();
      return state.syncJobs.filter((job) => job.userId === userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;
    },
    async upsertSyncJob(job) {
      const state = await loadPlatformState();
      const existing = state.syncJobs.findIndex((item) => item.id === job.id);
      if (existing >= 0) state.syncJobs[existing] = job; else state.syncJobs.push(job);
      await savePlatformState(state);
    },
    async getLatestSnapshot(userId, connectionId) {
      const state = await loadPlatformState();
      return state.intervalsSnapshots
        .filter((item) => item.userId === userId && (!connectionId || item.connectionId === connectionId))
        .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0] || null;
    },
    async upsertSnapshot(snapshot) {
      const state = await loadPlatformState();
      const existing = state.intervalsSnapshots.findIndex((item) => item.connectionId === snapshot.connectionId);
      if (existing >= 0) state.intervalsSnapshots[existing] = snapshot; else state.intervalsSnapshots.push(snapshot);
      await savePlatformState(state);
    },
  };
}

function postgresSyncStore(): SyncStore {
  return {
    async getLatestSyncJob(userId) {
      const result = await getPgPool().query(
        `select * from sync_jobs_runtime where user_id = $1 order by updated_at desc limit 1`,
        [userId],
      );
      return result.rows[0] ? mapSyncJob(result.rows[0]) : null;
    },
    async upsertSyncJob(job) {
      await getPgPool().query(
        `insert into sync_jobs_runtime (id, user_id, connection_id, job_type, status, progress_pct, status_message, started_at, finished_at, last_error, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         on conflict (id) do update set
           user_id = excluded.user_id,
           connection_id = excluded.connection_id,
           job_type = excluded.job_type,
           status = excluded.status,
           progress_pct = excluded.progress_pct,
           status_message = excluded.status_message,
           started_at = excluded.started_at,
           finished_at = excluded.finished_at,
           last_error = excluded.last_error,
           updated_at = excluded.updated_at`,
        [job.id, job.userId, job.connectionId, job.jobType, job.status, job.progressPct, job.statusMessage, job.startedAt || null, job.finishedAt || null, job.lastError || null, job.updatedAt],
      );
    },
    async getLatestSnapshot(userId, connectionId) {
      const params: any[] = [userId];
      let sql = `select * from intervals_snapshots_runtime where user_id = $1`;
      if (connectionId) {
        params.push(connectionId);
        sql += ` and connection_id = $2`;
      }
      sql += ` order by captured_at desc limit 1`;
      const result = await getPgPool().query(sql, params);
      return result.rows[0] ? mapSnapshot(result.rows[0]) : null;
    },
    async upsertSnapshot(snapshot) {
      await getPgPool().query(
        `insert into intervals_snapshots_runtime (id, user_id, connection_id, source_job_id, captured_at, live_state_json)
         values ($1,$2,$3,$4,$5,$6::jsonb)
         on conflict (connection_id) do update set
           id = excluded.id,
           user_id = excluded.user_id,
           source_job_id = excluded.source_job_id,
           captured_at = excluded.captured_at,
           live_state_json = excluded.live_state_json`,
        [snapshot.id, snapshot.userId, snapshot.connectionId, snapshot.sourceJobId, snapshot.capturedAt, JSON.stringify(snapshot.liveState)],
      );
    },
  };
}

export function getSyncStore(): SyncStore {
  return isPostgresSyncStoreEnabled() ? postgresSyncStore() : fileSyncStore();
}

export async function getLatestSyncJobForUser(userId: string, fallbackJobs: SyncJobRecord[] = []): Promise<SyncJobRecord | null> {
  if (isPostgresSyncStoreEnabled()) {
    return getSyncStore().getLatestSyncJob(userId);
  }
  return fallbackJobs.filter((job) => job.userId === userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;
}

export async function getLatestSnapshotForUser(
  userId: string,
  connectionId?: string,
  fallbackSnapshots: IntervalsSnapshotRecord[] = [],
): Promise<IntervalsSnapshotRecord | null> {
  if (isPostgresSyncStoreEnabled()) {
    return getSyncStore().getLatestSnapshot(userId, connectionId);
  }
  return fallbackSnapshots
    .filter((snapshot) => snapshot.userId === userId && (!connectionId || snapshot.connectionId === connectionId))
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0] || null;
}
