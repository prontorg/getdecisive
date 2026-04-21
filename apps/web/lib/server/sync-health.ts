import type { IntervalsConnectionRecord, OnboardingRunRecord, SyncJobRecord } from './platform-state';
import { getLatestSnapshotForUser, getLatestSyncJobForUser } from './sync-store';
import { getPlatformState } from './auth-store';

function formatUtc(value?: string | null, empty = '—') {
  if (!value) return empty;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return empty;
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  }) + ' UTC';
}

function deriveSyncHealthLabel(params: {
  connection: IntervalsConnectionRecord | null;
  onboarding: OnboardingRunRecord | null;
  syncJob: SyncJobRecord | null;
  snapshotCapturedAt?: string | null;
}) {
  const { connection, onboarding, syncJob, snapshotCapturedAt } = params;
  if (!connection) return 'Not connected';
  if (syncJob?.status === 'failed') return 'Sync failed';
  if (syncJob?.status === 'running') return 'Sync running';
  if (syncJob?.status === 'queued') return 'Sync queued';
  if (onboarding?.state === 'ready' || snapshotCapturedAt) return 'Ready';
  if (connection.syncStatus === 'sync_started') return 'Waiting for first snapshot';
  return 'Connection saved';
}

export type SyncHealthSummary = {
  healthLabel: string;
  jobLabel: string;
  snapshotLabel: string;
  athleteIdLabel: string;
  failureReason: string | null;
  connectionState: string;
  latestJobStatus: SyncJobRecord['status'] | null;
  latestJobMessage: string | null;
  latestJobUpdatedAt: string | null;
  latestSnapshotCapturedAt: string | null;
};

export async function getSyncHealthSummary(
  userId: string,
  options: { connection?: IntervalsConnectionRecord | null; onboarding?: OnboardingRunRecord | null } = {},
): Promise<SyncHealthSummary> {
  const state = await getPlatformState();
  const connection = options.connection === undefined
    ? state.intervalsConnections.filter((item) => item.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null
    : options.connection;
  const onboarding = options.onboarding === undefined
    ? state.onboardingRuns.find((item) => item.userId === userId) || null
    : options.onboarding;
  const syncJob = await getLatestSyncJobForUser(userId, state.syncJobs);
  const snapshot = connection ? await getLatestSnapshotForUser(userId, connection.id, state.intervalsSnapshots) : null;
  const healthLabel = deriveSyncHealthLabel({
    connection,
    onboarding,
    syncJob,
    snapshotCapturedAt: snapshot?.capturedAt || null,
  });

  return {
    healthLabel,
    jobLabel: syncJob
      ? `${syncJob.status} • ${syncJob.progressPct}% • ${syncJob.statusMessage}`
      : connection
        ? 'No sync job recorded yet'
        : 'Connect Intervals to start sync',
    snapshotLabel: snapshot?.capturedAt
      ? `Last snapshot ${formatUtc(snapshot.capturedAt)}`
      : connection
        ? 'No snapshot captured yet'
        : 'No snapshot yet',
    athleteIdLabel: connection?.externalAthleteId || '—',
    failureReason: syncJob?.lastError || null,
    connectionState: connection?.syncStatus || 'not connected',
    latestJobStatus: syncJob?.status || null,
    latestJobMessage: syncJob?.statusMessage || null,
    latestJobUpdatedAt: syncJob?.updatedAt ? `Last worker update ${formatUtc(syncJob.updatedAt)}` : null,
    latestSnapshotCapturedAt: snapshot?.capturedAt || null,
  };
}
