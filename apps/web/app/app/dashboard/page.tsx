import { redirect } from 'next/navigation';

import { PlannerTabs } from '../_components/planner-tabs';
import { appRoutes } from '../../../lib/routes';
import { buildPlannerDayPayload, getAuthorizedPlannerLiveContext } from '../../../lib/server/planner-data';
import { getAuthenticatedAppContext } from '../../../lib/server/app-context';
import { getSessionUserId } from '../../../lib/server/session';

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect(appRoutes.login);

  const appContext = await getAuthenticatedAppContext(userId, { requireReady: true });

  const planner = await getAuthorizedPlannerLiveContext(userId);
  if (!planner) redirect(appRoutes.onboardingSync);
  const day = buildPlannerDayPayload(planner.context.user, planner.live);
  const { user, onboarding, isAdmin } = appContext;

  return (
    <main className="page-shell">
      <section className="hero hero-pretty">
        <div className="hero-copy">
          <div className="kicker">Dashboard</div>
          <h1>What should happen today</h1>
          <p>
            Welcome, {user.displayName}. Keep this view focused on what was planned, what freshness allows,
            and what needs protecting next.
          </p>
          <div className="chip-row">
            <span className="chip">User: {user.email}</span>
            <span className="chip">Onboarding: {onboarding.state}</span>
          </div>
        </div>
      </section>

      <PlannerTabs active="dashboard" isAdmin={isAdmin} />

      <section className="metrics-grid">
        <div className="metric-card">
          <div className="kicker">Fitness</div>
          <h2>{day.ctl.toFixed(0)}</h2>
          <p>CTL</p>
        </div>
        <div className="metric-card">
          <div className="kicker">Fatigue</div>
          <h2>{day.atl.toFixed(0)}</h2>
          <p>ATL</p>
        </div>
        <div className="metric-card">
          <div className="kicker">Freshness</div>
          <h2 className={day.form >= 0 ? 'metric-value-positive' : 'metric-value-negative'}>{day.form >= 0 ? '+' : ''}{day.form.toFixed(0)}</h2>
          <p>Form</p>
        </div>
      </section>

      <section className="panel-grid-wide panel-grid">
        <div className="section-stack">
          <div className="card">
            <div className="kicker">Recommendation</div>
            <h2>{day.shouldActuallyHappenToday}</h2>
            <p>{day.why}</p>
            <p><strong>Planned today:</strong> {day.plannedToday}</p>
            <p><strong>Planned tomorrow:</strong> {day.plannedTomorrow}</p>
            <p><strong>Protect next:</strong> {day.nextToProtect}</p>
          </div>
          <div className="card">
            <div className="kicker">Readiness</div>
            <h2>Check before forcing quality</h2>
            <p>Use the Analysis tab for illness, adaptation, and goal-bias decisions. Keep this view operational.</p>
            <p><strong>Intervals writes:</strong> {day.intervalsPlanWriteState}</p>
          </div>
        </div>
        <div className="section-stack">
          <div className="card">
            <div className="kicker">Latest workout</div>
            <h2>Last workout day</h2>
            {day.latestWorkoutSummary ? <p>{day.latestWorkoutSummary}</p> : <p>No latest workout summary loaded yet.</p>}
          </div>
          <div className="card">
            <div className="kicker">Controls</div>
            <div className="button-row">
              <a href="/" className="button-link">Coach dashboard</a>
              <a href={appRoutes.analysis} className="button-link">Open Analysis</a>
              {isAdmin ? <a href={appRoutes.admin} className="button-link">Open Admin</a> : null}
              <form action="/planner/api/auth/logout" method="post"><button type="submit" className="button-secondary">Log out</button></form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
