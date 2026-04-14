import { redirect } from 'next/navigation';

import { appRoutes } from '../../../lib/routes';
import {
  buildGoalPayload,
  buildMonthlyPlannerComparePayload,
  buildMonthlyPlannerContextPayload,
  getAuthorizedPlannerLiveContext,
} from '../../../lib/server/planner-data';
import { getLatestMonthlyPlanDraft, getLatestMonthlyPlanInput, getUserGoalEntries } from '../../../lib/server/planner-customization';
import { getSessionUserId } from '../../../lib/server/session';
import { AppCard, AppHero, AppPageShell } from './material-shell';

const workoutActionLabels: Record<string, string> = {
  lock: 'Lock',
  easier: 'Easier',
  harder: 'Harder',
  remove: 'Remove',
  move_day: 'Move day',
};

const weekActionLabels: Record<string, string> = {
  regenerate: 'Regenerate week',
  reduce_load: 'Reduce load 10%',
  increase_specificity: 'Increase specificity',
  lighter_weekend: 'Make weekend lighter',
};

const objectiveOptions = [
  { value: 'repeatability', label: 'Build repeatability for track racing' },
  { value: 'threshold_support', label: 'Raise threshold support' },
  { value: 'race_specificity', label: 'Increase race-like specificity' },
  { value: 'aerobic_support', label: 'Build aerobic support without losing sharpness' },
  { value: 'rebuild', label: 'Rebuild after illness / disruption' },
  { value: 'consistency', label: 'Hold form and stay consistent' },
  { value: 'taper', label: 'Taper into key event' },
] as const;

const successOptions = [
  'Complete 4 consistent weeks',
  'Hit 2 quality sessions per week cleanly',
  'Improve repeatability density',
  'Arrive fresher for race demands',
] as const;

function fmtHours(value: number) {
  return `${value.toFixed(1)} h`;
}

function monthDays(monthStart: string) {
  const start = new Date(`${monthStart}T00:00:00Z`);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));
  const days: string[] = [];
  for (let day = 1; day <= last.getUTCDate(); day += 1) {
    days.push(new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10));
  }
  return { first, days };
}

function weekdayLabel(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

export async function TrainingPlanPage({
  mode = 'plan',
  moveConflict,
  moveConflictReason,
  moveConflictSuggestedDate,
  notice,
}: {
  mode?: 'plan' | 'calendar';
  moveConflict?: string;
  moveConflictReason?: string;
  moveConflictSuggestedDate?: string;
  notice?: string;
} = {}) {
  const userId = await getSessionUserId();
  if (!userId) redirect(appRoutes.login);

  const planner = await getAuthorizedPlannerLiveContext(userId);
  if (!planner) redirect(appRoutes.onboardingSync);

  const goalEntries = await getUserGoalEntries(userId);
  const latestInput = await getLatestMonthlyPlanInput(userId);
  const latestDraft = await getLatestMonthlyPlanDraft(userId);
  const currentDirection = buildGoalPayload(planner.live, goalEntries).goalHistory[0]?.title;
  const contextPayload = buildMonthlyPlannerContextPayload(planner.live, currentDirection);
  const comparePayload = buildMonthlyPlannerComparePayload(planner.live, latestDraft ? {
    monthStart: latestDraft.monthStart,
    objective: latestInput?.objective || 'repeatability',
    ambition: latestInput?.ambition || 'balanced',
    assumptions: {
      ctl: latestDraft.assumptions.ctl || 0,
      atl: latestDraft.assumptions.atl || 0,
      form: latestDraft.assumptions.form || 0,
      recentSummary: latestDraft.assumptions.recentSummary,
      availabilitySummary: latestDraft.assumptions.availabilitySummary,
      guardrailSummary: latestDraft.assumptions.guardrailSummary,
    },
    weeks: latestDraft.weeks,
  } : null);
  const calendarDays = latestDraft ? monthDays(latestDraft.monthStart).days : [];
  const isCalendarMode = mode === 'calendar';
  const heroTitle = isCalendarMode ? 'Calendar' : 'Plan';
  const heroEyebrow = isCalendarMode ? 'Calendar' : 'Plan';
  const heroDescription = isCalendarMode
    ? 'Calendar-first monthly planning surface with month visibility, conflict-aware workout actions, and recent-vs-planned comparison.'
    : 'Build next 4 weeks from your live Intervals context, then refine only the future with explicit constraints, rationale, and safe publish rules.';
  const reviewsIntro = isCalendarMode
    ? 'Calendar-first monthly planning surface. Keep the whole month visible, act on one session at a time, and drop into detail only when needed.'
    : 'Calendar is the main review surface. Keep the month visible, act on one session at a time, then open details only when you need extra rationale.';
  const workoutsByDate = new Map<string, typeof latestDraft extends infer T ? any : never>();
  if (latestDraft) {
    for (const workout of latestDraft.weeks.flatMap((week) => week.workouts)) {
      const existing = workoutsByDate.get(workout.date) || [];
      existing.push(workout);
      workoutsByDate.set(workout.date, existing);
    }
  }

  return (
    <AppPageShell>
      <AppHero
        eyebrow={heroEyebrow}
        title={heroTitle}
        description={heroDescription}
      />

      <section className="card md-surface md-surface-card mt-18">
        <div className="kicker">Monthly planner flow</div>
        <h2>Build next 4 weeks</h2>
        {notice ? (
          <div className="status-list compact-status-list">
            <div className="status-item">
              <strong>Success</strong>
              <p>{notice}</p>
            </div>
          </div>
        ) : null}
        {moveConflict ? (
          <div className="status-list compact-status-list">
            <div className="status-item">
              <strong>Move conflict</strong>
              <p>{moveConflictReason || 'A same-day or sequencing conflict blocked the move.'}</p>
              {moveConflictSuggestedDate ? (
                <>
                  <p>Suggested safer day: {moveConflictSuggestedDate}</p>
                  <form action="/api/planner/month/workout" method="post" className="button-row">
                    <input type="hidden" name="draftId" value={latestDraft?.id || ''} />
                    <input type="hidden" name="workoutId" value={moveConflict} />
                    <input type="hidden" name="action" value="move_day" />
                    <input type="hidden" name="moveDate" value={moveConflictSuggestedDate} />
                    <button type="submit">Use suggested day</button>
                  </form>
                </>
              ) : <p>No safer nearby day was found automatically.</p>}
            </div>
          </div>
        ) : null}
        <div className="chip-row">
          <span className="chip">Confirm Context</span>
          <span className="chip">Set Month Direction</span>
          <span className="chip">Review Draft</span>
          <span className="chip">Publish</span>
          {isCalendarMode ? (
            <a href={appRoutes.plan} className="button-secondary button-link">Back to plan builder</a>
          ) : (
            <a href={appRoutes.calendar} className="button-secondary button-link">Open full calendar</a>
          )}
        </div>
      </section>

      {!isCalendarMode ? (
        <section className="training-plan-grid training-plan-grid-cards mt-18">
        <AppCard className="training-plan-card">
          <div className="kicker">Confirm Context</div>
          <h3>Build next 4 weeks</h3>
          <p>Using your recent training, current fitness, and goals.</p>
          <div className="status-list compact-status-list">
            <div className="status-item">
              <strong>Goal / Event</strong>
              <p>{contextPayload.goalEvent.title}{contextPayload.goalEvent.date ? ` • ${contextPayload.goalEvent.date}` : ''}</p>
              {contextPayload.goalEvent.currentDirection ? <p>{contextPayload.goalEvent.currentDirection}</p> : null}
            </div>
            <div className="status-item">
              <strong>Current state</strong>
              <p>CTL {contextPayload.currentState.ctl} • ATL {contextPayload.currentState.atl} • Form {contextPayload.currentState.form >= 0 ? '+' : ''}{contextPayload.currentState.form}</p>
              <p>{contextPayload.currentState.freshnessSummary}</p>
            </div>
            <div className="status-item">
              <strong>Recent history</strong>
              <p>{contextPayload.recentHistory.loadSummary}</p>
              <p>{contextPayload.recentHistory.repeatablePattern}</p>
            </div>
            <div className="status-item">
              <strong>Availability</strong>
              <p>{contextPayload.availability.summary.join(' ')}</p>
            </div>
            <div className="status-item">
              <strong>Guardrails</strong>
              <p>{contextPayload.guardrails.summary.join(' ')}</p>
            </div>
          </div>
          <div className="button-row">
            <button type="button">Looks right</button>
          </div>
        </AppCard>

        <AppCard className="training-plan-card training-plan-grid-main">
          <div className="kicker">Set Month Direction</div>
          <h3>What should this month do?</h3>
          <p>Set the direction, then generate a realistic draft that respects your life and freshness management.</p>
          <form action="/api/planner/month/draft" method="post" className="form-grid">
            <label>
              <span>Main objective</span>
              <select name="objective" defaultValue={latestInput?.objective || 'repeatability'}>
                {objectiveOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <div className="form-split">
              <label>
                <span>Ambition</span>
                <select name="ambition" defaultValue={latestInput?.ambition || 'balanced'}>
                  <option value="conservative">Conservative</option>
                  <option value="balanced">Balanced</option>
                  <option value="ambitious">Ambitious</option>
                </select>
              </label>
              <label>
                <span>Max weekly hours</span>
                <input name="maxWeeklyHours" type="number" min="4" max="20" step="0.5" defaultValue={latestInput?.mustFollow.maxWeeklyHours || 10.5} />
              </label>
            </div>
            <fieldset>
              <legend>Success this month looks like</legend>
              <div className="chip-row">
                {successOptions.map((item) => (
                  <label key={item} className="chip">
                    <input type="checkbox" name="successMarkers" value={item} defaultChecked={latestInput?.successMarkers.includes(item)} /> {item}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="form-split">
              <AppCard>
                <div className="kicker">Must follow</div>
                <p>Must follow</p>
                <label><span>No doubles</span><input name="noDoubles" type="checkbox" defaultChecked={latestInput?.mustFollow.noDoubles ?? true} /></label>
                <label><span>No back-to-back hard days</span><input name="noBackToBackHardDays" type="checkbox" defaultChecked={latestInput?.mustFollow.noBackToBackHardDays ?? true} /></label>
              </AppCard>
              <AppCard>
                <div className="kicker">Prefer if possible</div>
                <p>Prefer if possible</p>
                <label><span>Long ride day</span><input name="longRideDay" type="text" defaultValue={latestInput?.preferences.longRideDay || 'Sunday'} /></label>
                <label><span>Rest day</span><input name="restDay" type="text" defaultValue={latestInput?.preferences.restDay || 'Friday'} /></label>
              </AppCard>
            </div>
            <label>
              <span>Anything special?</span>
              <textarea name="note" rows={3} defaultValue={latestInput?.note || ''} />
            </label>
            <div className="button-row">
              <button type="submit">Generate draft</button>
            </div>
          </form>
        </AppCard>
      </section>
      ) : null}

      <section className="training-plan-grid training-plan-grid-top mt-18">
        <AppCard className="training-plan-card training-plan-grid-main">
          <div className="kicker">Review Draft</div>
          <h2>Your next 4 weeks</h2>
          {latestDraft ? (
            <>
              <div className="status-list compact-status-list">
                <div className="status-item">
                  <strong>Calendar Review</strong>
                  <p>{reviewsIntro}</p>
                </div>
              </div>
              <div className="training-plan-state-pills training-plan-state-pills-quad">
                {latestDraft.weeks.map((week) => (
                  <div key={week.id} className="training-plan-pill">
                    <span className="training-plan-pill__label">Week {week.weekIndex}</span>
                    <strong>{week.label}</strong>
                    <span>{fmtHours(week.targetHours)} • Load {week.targetLoad}</span>
                  </div>
                ))}
              </div>
              <div className="button-row">
                <button type="button">Compare to recent 4 weeks</button>
              </div>
              <div className="status-list compact-status-list">
                <div className="status-item">
                  <strong>Month view</strong>
                  <p>Simpler calendar view with dropdown actions for each planned session.</p>
                </div>
              </div>
              <div className="panel-grid">
                {calendarDays.map((date) => {
                  const dayWorkouts = (workoutsByDate.get(date) || []) as any[];
                  return (
                    <div key={date} className="status-item">
                      <strong>{date} • {weekdayLabel(date)}</strong>
                      <p>{dayWorkouts.length ? `${dayWorkouts.length} planned item${dayWorkouts.length > 1 ? 's' : ''}` : 'No planned session'}</p>
                      {dayWorkouts.map((workout) => (
                        <form key={workout.id} action="/api/planner/month/workout" method="post" className="form-grid">
                          <input type="hidden" name="draftId" value={latestDraft.id} />
                          <input type="hidden" name="workoutId" value={workout.id} />
                          <input type="hidden" name="locked" value={workout.locked ? 'false' : 'true'} />
                          <div>
                            <strong>{workout.label}</strong>
                            <p>{workout.category} • {workout.durationMinutes || 0} min • Load {workout.targetLoad || 0}</p>
                            <p>{workout.locked ? 'Locked future session.' : 'Unlocked future session.'} Source: {workout.source}. Status: {workout.status}.</p>
                          </div>
                          <label>
                            <span>Action</span>
                            <select name="action" defaultValue="move_day">
                              <option value="move_day">Move day</option>
                              <option value="easier">Easier</option>
                              <option value="harder">Harder</option>
                              <option value="lock">Lock / unlock</option>
                              <option value="remove">Remove</option>
                            </select>
                          </label>
                          <label>
                            <span>Move day</span>
                            <input type="date" name="moveDate" defaultValue={workout.date} />
                          </label>
                          <button type="submit">Apply</button>
                        </form>
                      ))}
                    </div>
                  );
                })}
              </div>
              <details>
                <summary>Legacy detail view</summary>
                <div className="status-list compact-status-list">
                  {latestDraft.weeks.map((week) => (
                    <div key={week.id} className="status-item">
                      <strong>Week {week.weekIndex}: {week.label}</strong>
                      <p>{week.intent}</p>
                      <p>{week.rationale.carriedForward}</p>
                      <p>{week.rationale.protected}</p>
                      <p>{week.rationale.mainAim}</p>
                      <p>Week controls</p>
                      <div className="button-row">
                        {Object.entries(weekActionLabels).map(([action, label]) => (
                          <form key={action} action="/api/planner/month/week" method="post">
                            <input type="hidden" name="draftId" value={latestDraft.id} />
                            <input type="hidden" name="weekId" value={week.id} />
                            <input type="hidden" name="action" value={action} />
                            <button type="submit">{label}</button>
                          </form>
                        ))}
                      </div>
                      <div className="status-list compact-status-list">
                        {week.workouts.map((workout) => (
                          <div key={workout.id} className="status-item">
                            <strong>{workout.date} • {workout.label}</strong>
                            <p>{workout.category} • {workout.durationMinutes || 0} min • Load {workout.targetLoad || 0}</p>
                            <p>{workout.locked ? 'Locked future session.' : 'Unlocked future session.'} Source: {workout.source}. Status: {workout.status}.</p>
                            <p>Move-day conflict guard prevents same-day collisions and back-to-back hard-day conflict.</p>
                            <div className="button-row">
                              {Object.entries(workoutActionLabels).map(([action, label]) => (
                                <form key={action} action="/api/planner/month/workout" method="post">
                                  <input type="hidden" name="draftId" value={latestDraft.id} />
                                  <input type="hidden" name="workoutId" value={workout.id} />
                                  <input type="hidden" name="action" value={action} />
                                  {action === 'lock' ? <input type="hidden" name="locked" value={workout.locked ? 'false' : 'true'} /> : null}
                                  {action === 'move_day' ? <input type="date" name="moveDate" defaultValue={workout.date} /> : null}
                                  <button type="submit">{action === 'lock' ? (workout.locked ? 'Unlock' : label) : label}</button>
                                </form>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
              <div className="status-list compact-status-list">
                <div className="status-item">
                  <strong>{comparePayload.recentWindow.label}</strong>
                  <p>{fmtHours(comparePayload.recentWindow.totalHours)} • Load {comparePayload.recentWindow.totalLoad} • {comparePayload.recentWindow.totalSessions} sessions</p>
                </div>
                <div className="status-item">
                  <strong>{comparePayload.draftWindow.label}</strong>
                  <p>{fmtHours(comparePayload.draftWindow.totalHours)} • Load {comparePayload.draftWindow.totalLoad} • {comparePayload.draftWindow.totalSessions} sessions</p>
                </div>
                <div className="status-item">
                  <strong>Summary</strong>
                  <p>{comparePayload.summary}</p>
                </div>
              </div>
              <div className="status-list compact-status-list">
                {comparePayload.categoryComparison.map((item) => (
                  <div key={item.category} className="status-item">
                    <strong>{item.category}</strong>
                    <p>Recent: {item.recentSessions} sessions / {fmtHours(item.recentHours)}</p>
                    <p>Planned: {item.plannedSessions} sessions / {fmtHours(item.plannedHours)}</p>
                    <p>Delta sessions: {item.deltaSessions >= 0 ? '+' : ''}{item.deltaSessions}</p>
                  </div>
                ))}
              </div>
              <div className="status-list compact-status-list">
                <div className="status-item">
                  <strong>Freshness risk</strong>
                  {comparePayload.freshnessWarnings.length ? (
                    comparePayload.freshnessWarnings.map((warning) => <p key={warning}>{warning}</p>)
                  ) : (
                    <p>No major freshness risk is visible from the current recent-vs-planned comparison.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p>No monthly draft saved yet. Generate draft to create your first 4-week block.</p>
          )}
        </AppCard>

        <AppCard className="training-plan-card">
          <div className="kicker">Publish</div>
          <h3>Publish plan</h3>
          <p>Completed sessions never change. Locked future sessions never change. Only future unlocked sessions can be regenerated or published.</p>
          <p>{latestDraft?.publishState === 'published' ? 'Current draft has been published locally.' : 'Publish writes only to the local planner state for now, not back to Intervals.'}</p>
          <div className="button-row">
            {latestDraft ? (
              <form action="/api/planner/month/publish" method="post">
                <input type="hidden" name="draftId" value={latestDraft.id} />
                <button type="submit">Publish plan</button>
              </form>
            ) : (
              <button type="button">Publish plan</button>
            )}
          </div>
        </AppCard>
      </section>
    </AppPageShell>
  );
}
