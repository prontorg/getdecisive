import { NextResponse } from 'next/server';

import { loadPlatformState } from '../../../../lib/server/dev-store';
import { deriveOnboardingStatus } from '../../../../lib/server/platform-state';
import { getSessionUserId } from '../../../../lib/server/session';
import { getLatestSnapshotForUser, getLatestSyncJobForUser } from '../../../../lib/server/sync-store';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ state: 'invite_pending', progressPct: 0, statusMessage: 'No session' }, { status: 401 });
  }

  const state = await loadPlatformState();
  const onboarding = deriveOnboardingStatus(state, userId);
  const syncJob = await getLatestSyncJobForUser(userId, state.syncJobs);
  const connection = syncJob ? state.intervalsConnections.find((item) => item.id === syncJob.connectionId && item.userId === userId) || null : null;
  const snapshot = connection ? await getLatestSnapshotForUser(userId, connection.id, state.intervalsSnapshots) : null;
  if (syncJob?.status === 'completed' && snapshot && onboarding) {
    onboarding.state = 'ready';
    onboarding.progressPct = 100;
    onboarding.statusMessage = 'Dashboard ready';
  }
  if (!onboarding) {
    return NextResponse.json({ state: 'invite_pending', progressPct: 0, statusMessage: 'No onboarding found' }, { status: 404 });
  }

  return NextResponse.json(onboarding);
}
