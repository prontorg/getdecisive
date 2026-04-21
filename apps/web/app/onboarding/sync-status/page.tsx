import Link from 'next/link';
import { redirect } from 'next/navigation';

import { appRoutes } from '../../../lib/routes';
import { getDerivedOnboardingStatusRecord, getLatestIntervalsConnectionRecord, getUserByIdRecord } from '../../../lib/server/auth-store';
import { getSessionUserId } from '../../../lib/server/session';
import { getSyncHealthSummary } from '../../../lib/server/sync-health';

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

  const [onboarding, user, connection] = await Promise.all([
    getDerivedOnboardingStatusRecord(userId),
    getUserByIdRecord(userId),
    getLatestIntervalsConnectionRecord(userId),
  ]);

  if (!onboarding || !user) redirect(appRoutes.login);

  const syncHealth = await getSyncHealthSummary(userId, { connection, onboarding });
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
          <div className="status-list compact-status-list" style={{ marginTop: 16 }}>
            <div className="status-item"><strong>Sync health</strong><p>{syncHealth.healthLabel}</p></div>
            <div className="status-item"><strong>Worker</strong><p>{syncHealth.jobLabel}</p></div>
            <div className="status-item"><strong>Last snapshot</strong><p>{syncHealth.snapshotLabel}</p></div>
            <div className="status-item"><strong>Athlete ID</strong><p>{syncHealth.athleteIdLabel}</p></div>
            {syncHealth.latestJobUpdatedAt ? <div className="status-item"><strong>Latest worker update</strong><p>{syncHealth.latestJobUpdatedAt}</p></div> : null}
            {syncHealth.failureReason ? <div className="status-item"><strong>Failure reason</strong><p>{syncHealth.failureReason}</p></div> : null}
          </div>
          {!isReady ? <p className="muted" style={{ marginTop: 12 }}>If this stalls, resave the Intervals connection to restart the user-scoped sync worker.</p> : null}
          <div className="button-row">
            {isReady ? <Link href={appRoutes.dashboard} className="button-link">Open dashboard</Link> : null}
            <Link href={appRoutes.onboardingIntervals} className="button-link button-secondary">Edit connection</Link>
            <Link href={`${appRoutes.account}?tab=profile`} className="button-link button-secondary">Open configuration</Link>
          </div>
        </section>
      </section>
    </main>
  );
}
