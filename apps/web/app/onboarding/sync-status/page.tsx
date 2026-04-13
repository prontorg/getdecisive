import Link from 'next/link';
import { redirect } from 'next/navigation';

import { appRoutes } from '../../../lib/routes';
import { loadPlatformState } from '../../../lib/server/dev-store';
import { deriveOnboardingStatus, getUserById } from '../../../lib/server/platform-state';
import { getSessionUserId } from '../../../lib/server/session';
import { getLatestSnapshotForUser, getLatestSyncJobForUser } from '../../../lib/server/sync-store';

const steps = [
  { label: 'Invite accepted', state: 'account_created' },
  { label: 'Intervals credentials submitted', state: 'intervals_credentials_submitted' },
  { label: 'Sync started', state: 'sync_started' },
  { label: 'Importing history', state: 'sync_importing_history' },
  { label: 'Processing activities', state: 'sync_processing_activities' },
  { label: 'Building dashboard', state: 'sync_building_dashboard' },
  { label: 'Ready', state: 'ready' },
] as const;

const stateOrder = new Map<string, number>(steps.map((step, index) => [step.state, index]));

export default async function SyncStatusPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect(appRoutes.login);

  const state = await loadPlatformState();
  const onboarding = deriveOnboardingStatus(state, userId);
  const syncJob = await getLatestSyncJobForUser(userId, state.syncJobs);
  const connection = syncJob ? state.intervalsConnections.find((item) => item.id === syncJob.connectionId && item.userId === userId) || null : null;
  const snapshot = connection ? await getLatestSnapshotForUser(userId, connection.id, state.intervalsSnapshots) : null;
  const user = getUserById(state, userId);

  if (syncJob?.status === 'completed' && snapshot && onboarding) {
    onboarding.state = 'ready';
    onboarding.progressPct = 100;
    onboarding.statusMessage = 'Dashboard ready';
  }

  if (!onboarding || !user) redirect(appRoutes.login);

  const currentIndex = stateOrder.get(onboarding.state) ?? 0;
  const isReady = onboarding.state === 'ready';

  return (
    <main className="page-shell">
      {!isReady ? <meta httpEquiv="refresh" content="4" /> : null}
      <section className="hero">
        <div className="hero-copy">
          <div className="kicker">Onboarding status</div>
          <h1>Preparing {user.displayName}'s training view</h1>
          <p>{onboarding.statusMessage}</p>
          <div className="chip-row">
            <span className="chip">Progress {onboarding.progressPct}%</span>
            <span className="chip">State: {onboarding.state}</span>
          </div>
        </div>
      </section>
      <section className="panel-grid">
        <section className="card">
          <div className="kicker">Sync progression</div>
          <div className="status-list">
            {steps.map((step, index) => {
              const status = index < currentIndex ? 'done' : index == currentIndex ? 'active' : 'pending';
              return (
                <div key={step.state} className={`status-item ${status}`}>
                  <strong>{index + 1}. {step.label}</strong>
                  <div className="muted">{status === 'done' ? 'Completed' : status === 'active' ? onboarding.statusMessage : 'Waiting'}</div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="card">
          <div className="kicker">Access rule</div>
          <h2>{isReady ? 'Dashboard unlocked' : 'App locked until sync is ready'}</h2>
          <p>
            {isReady
              ? 'The user can now enter the platform dashboard shell.'
              : 'This matches the approved rule: no app entry until Intervals onboarding and initial processing are complete.'}
          </p>
          <div className="button-row">
            {isReady ? <Link href={appRoutes.dashboard} className="button-link">Open dashboard</Link> : null}
            <Link href={appRoutes.onboardingIntervals} className="button-link button-secondary">Edit connection</Link>
          </div>
        </section>
      </section>
    </main>
  );
}
