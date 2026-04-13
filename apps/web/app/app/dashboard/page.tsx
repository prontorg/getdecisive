import { redirect } from 'next/navigation';

import { PlannerTabs } from '../_components/planner-tabs';
import { appRoutes } from '../../../lib/routes';
import { loadPlatformState, savePlatformState } from '../../../lib/server/dev-store';
import { buildPlannerDayPayload, getAuthenticatedPlannerContext, getLiveIntervalsState } from '../../../lib/server/planner-data';
import { deriveOnboardingStatus, getOnboardingRun, getUserById, isAdminUser } from '../../../lib/server/platform-state';
import { getSessionUserId } from '../../../lib/server/session';

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect(appRoutes.login);

  const state = await loadPlatformState();
  const onboarding = deriveOnboardingStatus(state, userId) || getOnboardingRun(state, userId);
  await savePlatformState(state);
  const user = getUserById(state, userId);

  if (!user || !onboarding) redirect(appRoutes.login);
  if (onboarding.state !== 'ready') redirect(appRoutes.onboardingSync);

  const plannerContext = await getAuthenticatedPlannerContext(userId);
  if (!plannerContext) redirect(appRoutes.onboardingSync);
  const live = await getLiveIntervalsState();
  const day = buildPlannerDayPayload(plannerContext.user, live);
  const isAdmin = isAdminUser(state, userId);

  return (
    <main className="page-shell">
      <section className="hero hero-pretty">
        <div className="hero-copy">
          <div className="kicker">Planning</div>
          <h1>What should happen today</h1>
          <p>
            Welcome, {user.displayName}. Keep this view focused on what was planned, what freshness allows,
            and what needs protecting next.
          </p>
          <div className="chip-row">
            <span className="chip">User: {user.email}</span>
            <span className="chip">Onboarding: {onboarding.state}</span>
            <span className="chip">Goal race: {day.goalRaceDate || 'not set'}</span>
          </div>
        </div>
      </section>

      <PlannerTabs active="dashboard" isAdmin={isAdmin} />

      <section className="panel-grid">
        <div className="card">
          <div className="kicker">Recommendation</div>
          <h2>{day.shouldActuallyHappenToday}</h2>
          <p>{day.why}</p>
          <p><strong>Planned today:</strong> {day.plannedToday}</p>
          <p><strong>Planned tomorrow:</strong> {day.plannedTomorrow}</p>
          <p><strong>Protect next:</strong> {day.nextToProtect}</p>
        </div>
        <div className="card">
          <div className="kicker">Fitness</div>
          <h2>CTL {day.ctl.toFixed(0)} • ATL {day.atl.toFixed(0)} • Form {day.form >= 0 ? '+' : ''}{day.form.toFixed(0)}</h2>
          <p>Live Intervals-derived freshness is feeding the planning recommendation.</p>
          {day.latestWorkoutSummary ? <p><strong>Latest workout day:</strong> {day.latestWorkoutSummary}</p> : null}
        </div>
        <div className="card">
          <div className="kicker">Readiness</div>
          <h2>Check before forcing quality</h2>
          <p>Use the Analysis tab for illness/adaptation notes and goal bias. Keep this view operational.</p>
          <p><strong>Intervals writes:</strong> {day.intervalsPlanWriteState}</p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Session controls</div>
        <div className="button-row">
          <a href="/" className="button-link">Coach dashboard</a>
          <a href={appRoutes.analysis} className="button-link">Open Analysis</a>
          {isAdmin ? <a href={appRoutes.admin} className="button-link">Open Admin</a> : null}
          <form action="/planner/api/auth/logout" method="post"><button type="submit" className="button-secondary">Log out</button></form>
        </div>
      </section>
    </main>
  );
}
