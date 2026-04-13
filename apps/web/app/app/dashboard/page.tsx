import { redirect } from 'next/navigation';

import { AppCard, AppHero, AppMetricCard, AppMetricStrip, AppPageShell, AppSectionColumns, AppSectionStack } from '../_components/material-shell';
import { appRoutes } from '../../../lib/routes';
import { fetchCoachDashboardState, flattenLatestFitnessLines, formatDuration, latestCoachingTake, latestWorkoutHeadline } from '../../../lib/server/coach-dashboard';
import { buildPlannerDayPayload, getAuthorizedPlannerLiveContext } from '../../../lib/server/planner-data';
import { getAuthenticatedAppContext } from '../../../lib/server/app-context';
import { getSessionUserId } from '../../../lib/server/session';

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect(appRoutes.login);

  const appContext = await getAuthenticatedAppContext(userId, { requireReady: true });
  const planner = await getAuthorizedPlannerLiveContext(userId);
  if (!planner) redirect(appRoutes.onboardingSync);

  const coachState = await fetchCoachDashboardState();
  const day = buildPlannerDayPayload(planner.context.user, planner.live);
  const { user, onboarding } = appContext;

  const latestActivity = coachState?.latest_day_rows?.[0] || coachState?.recent_rows?.[0] || null;
  const latestFitnessLines = flattenLatestFitnessLines(latestActivity);
  const latestTake = latestCoachingTake(latestActivity);
  const zoneEntries = Object.entries(coachState?.month_zone_totals || {}).sort((a, b) => Number(b[1]) - Number(a[1]));
  const weekEntries = Object.entries(coachState?.plan_map || {});

  return (
    <AppPageShell>
      <AppHero
        eyebrow="Dashboard"
        title="Coach dashboard"
        description={(
          <>
            Welcome, {user.displayName}. This is now the main decisive.coach application surface: live coaching context,
            today-vs-tomorrow guidance, and the richer dashboard content natively inside the platform.
          </>
        )}
        chips={(
          <>
            <span className="chip">User: {user.email}</span>
            <span className="chip">Onboarding: {onboarding.state}</span>
            <span className="chip">Source: decisive coach live state</span>
          </>
        )}
      />

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
            <div className="status-list compact-status-list">
              <div className="status-item"><strong>Planned today</strong><p>{coachState?.today_plan || day.plannedToday}</p></div>
              <div className="status-item"><strong>Planned tomorrow</strong><p>{coachState?.tomorrow_plan || day.plannedTomorrow}</p></div>
              <div className="status-item"><strong>Protect next</strong><p>{day.nextToProtect}</p></div>
            </div>
          </AppCard>

          <AppCard>
            <div className="kicker">Latest workout</div>
            <h2>{latestWorkoutHeadline(latestActivity)}</h2>
            <p className="muted">
              {latestActivity?.name || 'Recent training day'} • {formatDuration(latestActivity?.duration_s)}
              {latestActivity?.training_load ? ` • TL ${Math.round(latestActivity.training_load)}` : ''}
            </p>
            {latestTake ? <p>{latestTake}</p> : <p>{day.latestWorkoutSummary || 'No latest workout summary available yet.'}</p>}
            {latestFitnessLines.length ? <ul className="list">{latestFitnessLines.map((line) => <li key={line}>{line}</li>)}</ul> : null}
          </AppCard>
        </AppSectionStack>

        <AppSectionStack>
          <AppCard>
            <div className="kicker">Next 3 days</div>
            <div className="weather-grid-app">
              {(coachState?.next_three || []).map((item) => (
                <div className="weather-card-app" key={`${item.date}-${item.day}`}>
                  <div className="weather-topline-app">
                    <span>{item.day}</span>
                    <span>Zurich</span>
                  </div>
                  <div className="weather-icon-app">{item.weather?.icon || '🌤️'}</div>
                  <div className="weather-plan-app">{item.plan || 'Support endurance'}</div>
                  <div className="weather-temp-app">{item.weather?.tmax ?? '—'}°</div>
                  <div className="weather-copy-app">{item.weather?.label || 'Forecast pending'}</div>
                  <div className="weather-copy-app">Low {item.weather?.tmin ?? '—'}° • 💧 {item.weather?.precip ?? '—'}%</div>
                </div>
              ))}
            </div>
          </AppCard>

          <AppCard>
            <div className="kicker">Current month zone focus</div>
            {zoneEntries.length ? (
              <div className="status-list compact-status-list">
                {zoneEntries.slice(0, 6).map(([zone, seconds]) => (
                  <div className="status-item" key={zone}>
                    <strong>{zone}</strong>
                    <p>{formatDuration(Number(seconds))}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p>No month zone totals loaded yet.</p>
            )}
          </AppCard>
        </AppSectionStack>
      </AppSectionColumns>

      <AppCard className="mt-18">
        <div className="kicker">Week overview</div>
        <h2>Planned structure this week</h2>
        {weekEntries.length ? (
          <div className="status-list compact-status-list">
            {weekEntries.map(([dayIso, session]) => (
              <div className="status-item" key={dayIso}>
                <strong>{dayIso}</strong>
                <p>{session || 'Support endurance'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>No weekly structure loaded yet.</p>
        )}
      </AppCard>
    </AppPageShell>
  );
}
