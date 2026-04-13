import { redirect } from 'next/navigation';

import { PlannerTabs } from '../_components/planner-tabs';
import { AppCard, AppHero, AppMetricCard, AppMetricStrip, AppPageShell, AppSectionColumns, AppSectionStack } from '../_components/material-shell';
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
    <AppPageShell>
      <AppHero
        eyebrow="Dashboard"
        title="What should happen today"
        description={(
          <>
            Welcome, {user.displayName}. Keep this view focused on what was planned, what freshness allows,
            and what needs protecting next.
          </>
        )}
        chips={(
          <>
            <span className="chip">User: {user.email}</span>
            <span className="chip">Onboarding: {onboarding.state}</span>
          </>
        )}
      />

      <PlannerTabs active="dashboard" isAdmin={isAdmin} />

      <AppMetricStrip>
        <AppMetricCard label="Fitness" value={day.ctl.toFixed(0)} detail="CTL" />
        <AppMetricCard label="Fatigue" value={day.atl.toFixed(0)} detail="ATL" />
        <AppMetricCard label="Freshness" value={`${day.form >= 0 ? '+' : ''}${day.form.toFixed(0)}`} detail="Form" tone={day.form >= 0 ? 'positive' : 'negative'} />
      </AppMetricStrip>

      <AppSectionColumns variant="wide">
        <AppSectionStack>
          <AppCard>
            <div className="kicker">Recommendation</div>
            <h2>{day.shouldActuallyHappenToday}</h2>
            <p>{day.why}</p>
            <p><strong>Planned today:</strong> {day.plannedToday}</p>
            <p><strong>Planned tomorrow:</strong> {day.plannedTomorrow}</p>
            <p><strong>Protect next:</strong> {day.nextToProtect}</p>
          </AppCard>
          <AppCard>
            <div className="kicker">Readiness</div>
            <h2>Check before forcing quality</h2>
            <p>Use the Analysis tab for illness, adaptation, and goal-bias decisions. Keep this view operational.</p>
            <p><strong>Intervals writes:</strong> {day.intervalsPlanWriteState}</p>
          </AppCard>
        </AppSectionStack>
        <AppSectionStack>
          <AppCard>
            <div className="kicker">Latest workout</div>
            <h2>Last workout day</h2>
            {day.latestWorkoutSummary ? <p>{day.latestWorkoutSummary}</p> : <p>No latest workout summary loaded yet.</p>}
          </AppCard>
          <AppCard>
            <div className="kicker">Controls</div>
            <div className="button-row">
              <a href="/" className="button-link">Coach dashboard</a>
              <a href={appRoutes.analysis} className="button-link">Open Analysis</a>
              {isAdmin ? <a href={appRoutes.admin} className="button-link">Open Admin</a> : null}
              <form action="/planner/api/auth/logout" method="post"><button type="submit" className="button-secondary">Log out</button></form>
            </div>
          </AppCard>
        </AppSectionStack>
      </AppSectionColumns>
    </AppPageShell>
  );
}
