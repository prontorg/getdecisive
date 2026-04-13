import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PlannerTabs } from '../_components/planner-tabs';
import { appRoutes } from '../../../lib/routes';
import {
  authorizeLiveIntervalsState,
  buildAdaptationPayload,
  buildGoalPayload,
  buildPlannerDayPayload,
  buildPowerProfilePayload,
  getAuthenticatedPlannerContext,
  getLiveIntervalsState,
} from '../../../lib/server/planner-data';
import { loadPlatformState } from '../../../lib/server/dev-store';
import { getUserAdaptationEntries, getUserGoalEntries } from '../../../lib/server/planner-customization';
import { isAdminUser } from '../../../lib/server/platform-state';
import { getSessionUserId } from '../../../lib/server/session';

export default async function AnalysisPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect(appRoutes.login);

  const context = await getAuthenticatedPlannerContext(userId);
  if (!context) redirect(appRoutes.onboardingSync);

  const live = authorizeLiveIntervalsState(context, await getLiveIntervalsState());
  const state = await loadPlatformState();
  const isAdmin = isAdminUser(state, userId);
  const [goalEntries, adaptationEntries] = await Promise.all([
    getUserGoalEntries(userId),
    getUserAdaptationEntries(userId),
  ]);

  const day = buildPlannerDayPayload(context.user, live);
  const profile = buildPowerProfilePayload(live);
  const goals = buildGoalPayload(live, goalEntries);
  const adaptation = buildAdaptationPayload(live, adaptationEntries);

  return (
    <main className="page-shell">
      <section className="hero hero-pretty">
        <div className="hero-copy">
          <div className="kicker">Analysis</div>
          <h1>Strengths, weaknesses, goals, and adaptation</h1>
          <p>
            This is the separate deep-analysis tab. Daily operational guidance stays in Dashboard and Plan,
            while this view holds the bigger performance picture and why the planner changes.
          </p>
          <div className="chip-row">
            <span className="chip">Intervals writes: {day.intervalsPlanWriteState}</span>
            <span className="chip">Onboarding: {context.onboardingState}</span>
            <span className="chip">CTL {day.ctl.toFixed(0)} / ATL {day.atl.toFixed(0)} / Form {day.form >= 0 ? '+' : ''}{day.form.toFixed(0)}</span>
            {day.goalRaceDate ? <span className="chip">Goal race: {day.goalRaceDate}</span> : null}
          </div>
        </div>
      </section>

      <PlannerTabs active="analysis" isAdmin={isAdmin} />

      <section className="panel-grid">
        <div className="card">
          <div className="kicker">Today in context</div>
          <h2>{day.shouldActuallyHappenToday}</h2>
          <p>{day.why}</p>
          <p><strong>Planned today:</strong> {day.plannedToday}</p>
          <p><strong>Planned tomorrow:</strong> {day.plannedTomorrow}</p>
          <p><strong>Protect next:</strong> {day.nextToProtect}</p>
          {day.latestWorkoutSummary ? <p><strong>Latest workout day:</strong> {day.latestWorkoutSummary}</p> : null}
        </div>

        <div className="card">
          <div className="kicker">Power profile</div>
          <h2>Current strengths</h2>
          <ul className="list">{profile.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
          <h3>Current weaknesses</h3>
          <ul className="list">{profile.weaknesses.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>

        <div className="card">
          <div className="kicker">Goal alignment</div>
          <h2>Active goals</h2>
          <ul className="list">{goals.activeGoals.map((goal) => <li key={`${goal.title}-${goal.targetDate || 'none'}`}>{goal.title}{goal.targetDate ? ` • ${goal.targetDate}` : ''}</li>)}</ul>
          <h3>Current fit</h3>
          <p>{goals.currentPlanFitSummary}</p>
          <h3>Alignment summary</h3>
          <ul className="list">{profile.goalAlignmentSummary.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Power-curve highlights and live focus</div>
        <div className="panel-grid">
          {profile.powerCurveHighlights.map((item) => (
            <div className="card" key={item.label}>
              <div className="kicker">{item.label}</div>
              <h3>{item.value}</h3>
              <p>{item.interpretation}</p>
            </div>
          ))}
          <div className="card">
            <div className="kicker">Latest workout day</div>
            <ul className="list">{profile.latestWorkoutDay.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className="card">
            <div className="kicker">Current month zone focus</div>
            <ul className="list">{profile.monthZoneFocus.map((item) => <li key={item.zone}>{item.zone} • {item.hours}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="panel-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="kicker">Goal editor</div>
          <h2>Bias the month-first plan</h2>
          <p>Add live priorities for the next block without writing anything back to Intervals.</p>
          <form action="/planner/api/planner/goals/update" method="post" className="form-grid">
            <label>
              <span>Goal title</span>
              <input name="title" type="text" placeholder="e.g. Hold repeatability deeper into the block" required />
            </label>
            <div className="form-split">
              <label>
                <span>Goal type</span>
                <select name="type" defaultValue="capability_goal">
                  <option value="A_race">A race</option>
                  <option value="capability_goal">Capability goal</option>
                  <option value="block_focus">Block focus</option>
                </select>
              </label>
              <label>
                <span>Priority</span>
                <select name="priority" defaultValue="support">
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="support">Support</option>
                </select>
              </label>
            </div>
            <div className="form-split">
              <label>
                <span>Status</span>
                <select name="status" defaultValue="active">
                  <option value="active">Active</option>
                  <option value="watch">Watch</option>
                  <option value="parked">Parked</option>
                </select>
              </label>
              <label>
                <span>Target date</span>
                <input name="targetDate" type="date" defaultValue={day.goalRaceDate || ''} />
              </label>
            </div>
            <label>
              <span>Coach note</span>
              <textarea name="notes" rows={3} placeholder="Why this matters now, and what should be protected." />
            </label>
            <div className="button-row">
              <button type="submit">Save goal focus</button>
            </div>
          </form>
          {goals.goalHistory.length ? (
            <div className="status-list">
              {goals.goalHistory.map((item) => (
                <div className="status-item" key={`${item.title}-${item.updatedAt}`}>
                  <strong>{item.title}</strong>
                  <p>Priority {item.priority} • updated {item.updatedAt.slice(0, 10)}</p>
                  {item.notes ? <p>{item.notes}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="card">
          <div className="kicker">Sickness / adaptation input</div>
          <h2>Log today before forcing the session</h2>
          <p>Use this to keep the recommendation anchored to freshness, illness, and what needs protecting next.</p>
          <form action="/planner/api/planner/adaptation/check-in" method="post" className="form-grid">
            <div className="form-split form-split-quad">
              <label>
                <span>Legs</span>
                <input name="legs" type="range" min="1" max="5" defaultValue="3" />
              </label>
              <label>
                <span>Sleep</span>
                <input name="sleep" type="range" min="1" max="5" defaultValue="3" />
              </label>
              <label>
                <span>Soreness</span>
                <input name="soreness" type="range" min="1" max="5" defaultValue="3" />
              </label>
              <label>
                <span>Motivation</span>
                <input name="motivation" type="range" min="1" max="5" defaultValue="3" />
              </label>
            </div>
            <label className="check-row">
              <input name="illness" type="checkbox" />
              <span>Illness / disruption flag</span>
            </label>
            <label>
              <span>Coach note</span>
              <textarea name="note" rows={3} placeholder="Symptoms, travel, poor sleep, or reason to protect tomorrow." />
            </label>
            <div className="button-row">
              <button type="submit">Save check-in</button>
            </div>
          </form>
          <div className="status-list">
            {adaptation.recentCheckins.length ? adaptation.recentCheckins.map((entry) => (
              <div className="status-item" key={`${entry.date}-${entry.action}`}>
                <strong>{entry.date} • {entry.status.toUpperCase()}</strong>
                <p>{entry.action}</p>
                <p>{entry.illness ? 'Illness flagged.' : 'No illness flag.'}{entry.note ? ` ${entry.note}` : ''}</p>
              </div>
            )) : <div className="status-item"><strong>No check-ins yet.</strong><p>Once logged, this history becomes the manual context layer above the live Intervals signals.</p></div>}
          </div>
        </div>
      </section>

      <section className="panel-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="kicker">Trend direction by system</div>
          <ul className="list">{profile.trendDirectionBySystem.map((item) => <li key={item.system}><strong>{item.system}:</strong> {item.trend} — {item.note}</li>)}</ul>
        </div>
        <div className="card">
          <div className="kicker">Adaptation feedback</div>
          <h2>{adaptation.adaptationTrigger}</h2>
          <p>{adaptation.userFacingExplanation}</p>
          <ul className="list">{adaptation.sessionsChanged.map((item) => <li key={item}>{item}</li>)}</ul>
          <h3>Return criteria</h3>
          <ul className="list">{adaptation.returnToFullTrainingCriteria.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Navigation</div>
        <div className="button-row">
          <a href="/" className="button-link">Coach dashboard</a>
          <Link href={appRoutes.dashboard} className="button-link">Open Planning</Link>
          {isAdmin ? <Link href={appRoutes.admin} className="button-link">Open Admin</Link> : null}
        </div>
      </section>
    </main>
  );
}
