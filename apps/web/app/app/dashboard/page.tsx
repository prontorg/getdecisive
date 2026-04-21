import { redirect } from 'next/navigation';

import { AppCard, AppHero, AppPageShell } from '../_components/material-shell';
import { appRoutes } from '../../../lib/routes';
import { getLatestIntervalsConnectionRecord } from '../../../lib/server/auth-store';
import { fetchCoachDashboardEmbed } from '../../../lib/server/coach-dashboard';
import { getAuthenticatedAppContext } from '../../../lib/server/app-context';
import { getActivePlanningContext, getAuthorizedPlannerLiveContext } from '../../../lib/server/planner-data';
import { getSessionUserId } from '../../../lib/server/session';
import { getLatestSnapshotForUser } from '../../../lib/server/sync-store';

function formatLiveSyncStamp(value?: string | null) {
  if (!value) return 'Snapshot refresh pending';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Snapshot refresh pending';
  return `Last updated ${parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  })} UTC`;
}

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect(appRoutes.login);

  await getAuthenticatedAppContext(userId, { requireReady: true });
  const planner = await getAuthorizedPlannerLiveContext(userId);
  if (!planner) redirect(appRoutes.onboardingSync);
  const activePlanning = await getActivePlanningContext(userId);
  const latestConnection = await getLatestIntervalsConnectionRecord(userId);
  const latestSnapshot = latestConnection ? await getLatestSnapshotForUser(userId, latestConnection.id) : null;
  const liveSyncStamp = formatLiveSyncStamp(latestSnapshot?.capturedAt || null);

  const embed = await fetchCoachDashboardEmbed(userId);

  if (!embed) {
    return (
      <AppPageShell>
        <AppHero
          eyebrow="Training Dashboard"
          title="Training Dashboard"
          description={<>{'Live dashboard overview with current load, active weekly direction, today vs tomorrow calls, and the last activity context.'}<br />{liveSyncStamp}</>}
        />
        <section className="card md-surface md-surface-card">
          <div className="kicker">Dashboard unavailable</div>
          <h1>Coach dashboard could not be loaded</h1>
          <p className="muted">The live dashboard fragment did not load from the local coach service.</p>
        </section>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <AppHero
        eyebrow="Training Dashboard"
        title="Training Dashboard"
        description={<>{'Live load, week call, and latest activity.'}<br />{liveSyncStamp}</>}
      />
      {activePlanning.summary ? (
        <section className="dashboard-planning-stack">
          <AppCard className="dashboard-planning-card">
            <div className="kicker">Planning</div>
            <div className="dashboard-planning-card__header">
              <div>
                <h2>Week call</h2>
                <p className="muted">Live runtime leads. The draft follows.</p>
              </div>
              <div className="dashboard-planning-actions">
                <a href={appRoutes.plan} className="button-link">Open plan</a>
                <a href={appRoutes.calendar} className="button-secondary button-link">Open calendar</a>
              </div>
            </div>
            <div className="dashboard-planning-grid">
              <div className="training-plan-context-chip">
                <strong>Week intention</strong>
                <span>{activePlanning.summary.weekIntention}</span>
              </div>
              <div className="training-plan-context-chip">
                <strong>Planned today</strong>
                <span>{activePlanning.summary.plannedToday}</span>
              </div>
              <div className="training-plan-context-chip training-plan-context-chip-warning">
                <strong>Actually today</strong>
                <span>{activePlanning.summary.actualToday}</span>
              </div>
              <div className="training-plan-context-chip">
                <strong>Planned tomorrow</strong>
                <span>{activePlanning.summary.plannedTomorrow}</span>
              </div>
              <div className="training-plan-context-chip">
                <strong>Tomorrow likely becomes</strong>
                <span>{activePlanning.summary.likelyTomorrow}</span>
              </div>
              <div className="training-plan-context-chip training-plan-context-chip-warning">
                <strong>Why this is the call</strong>
                <span>{activePlanning.summary.reason}</span>
              </div>
            </div>
            <div className="dashboard-planning-subgrid">
              <div className="dashboard-planning-mini-card">
                <strong>Confidence</strong>
                <span>{activePlanning.summary.confidence || '—'}</span>
              </div>
              <div className="dashboard-planning-mini-card">
                <strong>Next key day</strong>
                <span>{activePlanning.summary.nextKeyDay || 'Protect the next quality slot once freshness allows.'}</span>
              </div>
              <div className="dashboard-planning-mini-card">
                <strong>Primary risk</strong>
                <span>{activePlanning.summary.risks[0] || 'No major risk surfaced in the live runtime layer.'}</span>
              </div>
            </div>
          </AppCard>
        </section>
      ) : null}
      <style dangerouslySetInnerHTML={{ __html: embed.styleTag }} />
      <div
        className="dashboard-fragment-host"
        dangerouslySetInnerHTML={{ __html: embed.bodyInnerHtml }}
      />
    </AppPageShell>
  );
}
