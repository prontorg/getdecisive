import { redirect } from 'next/navigation';

import { appRoutes } from '../../../lib/routes';
import {
  buildCurrentWeekReplanPayload,
  buildGoalPayload,
  buildMonthlyPlannerComparePayload,
  buildMonthlyPlannerContextPayload,
  buildMonthlyPlannerDraftPayload,
  getActivePlanningContext,
  getAuthorizedPlannerLiveContext,
  replaceCurrentWeekWithRuntime,
} from '../../../lib/server/planner-data';
import { getLatestMonthlyPlanDraft, getLatestMonthlyPlanInput, getUserGoalEntries, saveMonthlyPlanDraft } from '../../../lib/server/planner-customization';
import { getLatestIntervalsConnectionRecord } from '../../../lib/server/auth-store';
import { getSessionUserId } from '../../../lib/server/session';
import { getLatestSnapshotForUser } from '../../../lib/server/sync-store';
import { AppCard, AppHero, AppPageShell } from './material-shell';
import { TrainingPlanCalendar } from './training-plan-calendar';

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

function formatRange(dateA: string, dateB: string) {
  const start = new Date(`${dateA}T00:00:00Z`);
  const end = new Date(`${dateB}T00:00:00Z`);
  return `${start.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })} - ${end.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })}`;
}

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
  const activePlanning = await getActivePlanningContext(userId);
  const latestConnection = await getLatestIntervalsConnectionRecord(userId);
  const latestSnapshot = latestConnection ? await getLatestSnapshotForUser(userId, latestConnection.id) : null;
  const liveSyncStamp = formatLiveSyncStamp(latestSnapshot?.capturedAt || null);

  const goalEntries = await getUserGoalEntries(userId);
  const latestInput = await getLatestMonthlyPlanInput(userId);
  let latestDraft = await getLatestMonthlyPlanDraft(userId);
  const currentDirection = buildGoalPayload(planner.live, goalEntries).goalHistory[0]?.title;
  const today = planner.live?.today || new Date().toISOString().slice(0, 10);
  const currentMonthStart = `${today.slice(0, 8)}01`;
  const needsAutomaticDraftRefresh = Boolean(
    latestInput
      && (
        !latestDraft
        || latestDraft.monthStart !== currentMonthStart
        || (latestDraft.updatedAt || '').slice(0, 10) < today
      ),
  );

  if (latestInput && needsAutomaticDraftRefresh) {
    const regenerated = buildMonthlyPlannerDraftPayload(planner.live, {
      objective: latestInput.objective,
      ambition: latestInput.ambition,
      currentDirection,
      successMarkers: latestInput.successMarkers,
      mustFollow: {
        noBackToBackHardDays: latestInput.mustFollow.noBackToBackHardDays,
        maxWeeklyHours: latestInput.mustFollow.maxWeeklyHours,
      },
      preferences: {
        restDay: latestInput.preferences.restDay,
        restDaysPerWeek: latestInput.preferences.restDaysPerWeek,
        longRideDay: latestInput.preferences.longRideDay,
      },
    });
    const savedDrafts = await saveMonthlyPlanDraft(userId, {
      monthStart: regenerated.monthStart,
      inputId: latestInput.id,
      assumptions: regenerated.assumptions,
      weeks: regenerated.weeks.map((week) => ({
        id: `week_${week.weekIndex}`,
        weekIndex: week.weekIndex,
        label: week.label,
        intent: week.intent,
        targetHours: week.targetHours,
        targetLoad: week.targetLoad,
        longSessionDay: week.longSessionDay,
        completedThisWeek: (week.completedThisWeek || []).map((workout, index) => ({
          id: `cw_${week.weekIndex}_${index + 1}`,
          date: workout.date,
          label: workout.label,
          intervalLabel: workout.intervalLabel,
          category: workout.category,
          durationMinutes: workout.durationMinutes,
          targetLoad: workout.targetLoad,
          locked: true,
          source: 'completed',
          status: 'completed',
        })),
        rationale: week.rationale,
        workouts: week.workouts.map((workout, index) => ({
          id: `w_${week.weekIndex}_${index + 1}`,
          date: workout.date,
          label: workout.label,
          intervalLabel: workout.intervalLabel,
          category: workout.category,
          durationMinutes: workout.durationMinutes,
          targetLoad: workout.targetLoad,
          locked: workout.locked,
          source: 'generated',
          status: 'planned',
        })),
      })),
      publishState: latestDraft?.publishState === 'published' ? 'published' : 'draft',
    });
    latestDraft = savedDrafts[0] || null;
  }

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
  const isCalendarMode = mode === 'calendar';
  const heroTitle = isCalendarMode ? 'Calendar' : 'Plan';
  const heroEyebrow = isCalendarMode ? 'Calendar' : 'Plan';
  const heroDescription = isCalendarMode
    ? 'Calendar-first planner: the active week is shown from the live runtime layer, while later weeks stay editable in the monthly draft layer.'
    : 'Active week / today / tomorrow stay live runtime-backed. Future weeks, month shaping, and publish stay in the editable draft layer.';
  const reviewsIntro = isCalendarMode
    ? 'Month grid stays visible. The active week is a live runtime override; later weeks still come from the draft you can move, refine, and publish.'
    : 'Use the live active-week call for today/tomorrow, then edit only the future draft weeks and the remaining bridge slots inside this week.';
  const nextFourWeekRange = latestDraft?.weeks?.length
    ? formatRange(latestDraft.weeks[0]!.workouts[0]!.date, latestDraft.weeks[latestDraft.weeks.length - 1]!.workouts[latestDraft.weeks[latestDraft.weeks.length - 1]!.workouts.length - 1]!.date)
    : null;
  const displayedWeeks = latestDraft?.weeks
    ? replaceCurrentWeekWithRuntime({
      weeks: latestDraft.weeks,
      today,
      cycle: activePlanning.cycle,
      live: planner.live,
    })
    : null;
  const currentWeekBridge = latestDraft
    ? buildCurrentWeekReplanPayload(planner.live, {
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
    }, latestInput ? {
      objective: latestInput.objective,
      ambition: latestInput.ambition,
      currentDirection,
      mustFollow: {
        noBackToBackHardDays: latestInput.mustFollow.noBackToBackHardDays,
        maxWeeklyHours: latestInput.mustFollow.maxWeeklyHours,
      },
      preferences: {
        restDay: latestInput.preferences.restDay,
        restDaysPerWeek: latestInput.preferences.restDaysPerWeek,
        longRideDay: latestInput.preferences.longRideDay,
      },
    } : undefined)
    : null;

  return (
    <AppPageShell>
      <AppHero
        eyebrow={heroEyebrow}
        title={heroTitle}
        description={heroDescription}
      />

      {(notice || moveConflict) ? (
        <section className="mt-18">
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
        </section>
      ) : null}

      {!isCalendarMode ? (
        <section className="training-plan-top-strip mt-18">
          <AppCard className="training-plan-card training-plan-card-flat">
            <div className="training-plan-inline-layout">
              <div className="training-plan-inline-layout__context">
                <div className="kicker">Confirm Context</div>
                <h3>Current month setup</h3>
                <p className="training-plan-range-headline">{liveSyncStamp}</p>
                <div className="training-plan-context-grid training-plan-context-grid-compact training-plan-context-grid-fullwidth">
                  {activePlanning.summary ? (
                    <>
                      <div className="training-plan-context-chip">
                        <strong>Week intention</strong>
                        <span>{activePlanning.summary.weekIntention}</span>
                      </div>
                      <div className="training-plan-context-chip">
                        <strong>Planned today</strong>
                        <span>{activePlanning.summary.plannedToday}</span>
                      </div>
                      <div className="training-plan-context-chip">
                        <strong>Actually today</strong>
                        <span>{activePlanning.summary.actualToday}</span>
                      </div>
                      <div className="training-plan-context-chip">
                        <strong>Planned tomorrow</strong>
                        <span>{activePlanning.summary.plannedTomorrow}</span>
                      </div>
                      <div className="training-plan-context-chip">
                        <strong>Tomorrow likely</strong>
                        <span>{activePlanning.summary.likelyTomorrow}</span>
                      </div>
                      <div className="training-plan-context-chip">
                        <strong>Confidence</strong>
                        <span>{activePlanning.summary.confidence || 'Planning refresh pending'}</span>
                      </div>
                      <div className="training-plan-context-chip">
                        <strong>Next key day</strong>
                        <span>{activePlanning.summary.nextKeyDay || 'Protect the next quality slot once freshness allows.'}</span>
                      </div>
                      <div className="training-plan-context-chip training-plan-context-chip-warning">
                        <strong>Why this is the call</strong>
                        <span>{activePlanning.summary.reason}</span>
                      </div>
                    </>
                  ) : null}
                  <div className="training-plan-context-chip">
                    <strong>Goal</strong>
                    <span>{contextPayload.goalEvent.title}{contextPayload.goalEvent.date ? ` • ${contextPayload.goalEvent.date}` : ''}</span>
                  </div>
                  <div className="training-plan-context-chip">
                    <strong>State</strong>
                    <span>CTL {contextPayload.currentState.ctl} • ATL {contextPayload.currentState.atl} • Form {contextPayload.currentState.form >= 0 ? '+' : ''}{contextPayload.currentState.form}</span>
                  </div>
                  <div className="training-plan-context-chip">
                    <strong>Freshness</strong>
                    <span>{contextPayload.currentState.freshnessSummary}</span>
                  </div>
                  <div className="training-plan-context-chip">
                    <strong>Recent</strong>
                    <span>{contextPayload.recentHistory.repeatablePattern}</span>
                  </div>
                  <div className="training-plan-context-chip">
                    <strong>Availability</strong>
                    <span>{contextPayload.availability.summary.join(' ')}</span>
                  </div>
                  <div className="training-plan-context-chip">
                    <strong>Guardrails</strong>
                    <span>{contextPayload.guardrails.summary.join(' ')}</span>
                  </div>
                  <div className="training-plan-context-chip training-plan-context-chip-warning">
                    <strong>Freshness risk</strong>
                    <span>{comparePayload.freshnessWarnings[0] || 'No major freshness risk visible from the current recent-vs-planned comparison.'}</span>
                  </div>
                </div>
              </div>

              <form action="/api/planner/month/draft" method="post" className="training-plan-inline-layout__form training-plan-inline-layout__form-fullwidth">
                <div className="kicker">Set Month Direction</div>
                <h3>What should this month do?</h3>
                <div className="training-plan-direction-grid">
                  <label>
                    <span>Main objective</span>
                    <select name="objective" defaultValue={latestInput?.objective || 'repeatability'}>
                      {objectiveOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
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
                  <label>
                    <span>Rest day</span>
                    <select name="restDay" defaultValue={latestInput?.preferences.restDay || 'Saturday'}>
                      <option value="Monday">Monday</option>
                      <option value="Tuesday">Tuesday</option>
                      <option value="Wednesday">Wednesday</option>
                      <option value="Thursday">Thursday</option>
                      <option value="Friday">Friday</option>
                      <option value="Saturday">Saturday</option>
                      <option value="Sunday">Sunday</option>
                    </select>
                  </label>
                  <label>
                    <span>Rest days per week</span>
                    <select name="restDaysPerWeek" defaultValue={String(latestInput?.preferences.restDaysPerWeek || 1)}>
                      <option value="0">0</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                    </select>
                  </label>
                  <label>
                    <span>Long ride day</span>
                    <select name="longRideDay" defaultValue={latestInput?.preferences.longRideDay || 'Sunday'}>
                      <option value="Monday">Monday</option>
                      <option value="Tuesday">Tuesday</option>
                      <option value="Wednesday">Wednesday</option>
                      <option value="Thursday">Thursday</option>
                      <option value="Friday">Friday</option>
                      <option value="Saturday">Saturday</option>
                      <option value="Sunday">Sunday</option>
                    </select>
                  </label>
                </div>
                <div className="training-plan-inline-flags">
                  <label className="training-plan-compact-check"><input name="noDoubles" type="checkbox" defaultChecked={latestInput?.mustFollow.noDoubles ?? true} /> <span>No doubles</span></label>
                  <label className="training-plan-compact-check"><input name="noBackToBackHardDays" type="checkbox" defaultChecked={latestInput?.mustFollow.noBackToBackHardDays ?? true} /> <span>No back-to-back hard days</span></label>
                </div>
                <fieldset className="training-plan-success-fieldset">
                  <legend>Success this month looks like</legend>
                  <div className="chip-row">
                    {successOptions.map((item) => (
                      <label key={item} className="chip">
                        <input type="checkbox" name="successMarkers" value={item} defaultChecked={latestInput?.successMarkers.includes(item)} /> {item}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label>
                  <span>Anything special?</span>
                  <textarea name="note" rows={2} defaultValue={latestInput?.note || ''} />
                </label>
                <div className="button-row training-plan-top-strip__actions">
                  <button type="submit">Generate draft</button>
                </div>
              </form>
            </div>
          </AppCard>
        </section>
      ) : (
        <section className="mt-18 training-plan-top-strip__actions">
          <a href={appRoutes.plan} className="button-secondary button-link">Back to plan builder</a>
        </section>
      )}

      <section className="training-plan-review-stack mt-18">
        <AppCard className="training-plan-card training-plan-card-fullwidth">
          <div className="training-plan-review-header">
            <div>
              <div className="kicker">Review Draft</div>
              <h2>Your next 4 weeks</h2>
              {nextFourWeekRange ? <p className="training-plan-range-headline">{nextFourWeekRange}</p> : null}
              {latestDraft ? <p>{reviewsIntro}</p> : null}
            </div>
            {latestDraft ? null : null}
          </div>
          {latestDraft ? (
            <>
              <div className="training-plan-calendar-toolbar">
                <div className="status-item training-plan-week-decision-panel">
                  <strong>Active week • live runtime</strong>
                  <p>{activePlanning.summary?.weekIntention || 'Planning refresh pending'}</p>
                  <p>Planned today: {activePlanning.summary?.plannedToday || '—'}</p>
                  <p>Actually today: {activePlanning.summary?.actualToday || '—'}</p>
                  <p>Planned tomorrow: {activePlanning.summary?.plannedTomorrow || '—'}</p>
                  <p>Tomorrow likely becomes: {activePlanning.summary?.likelyTomorrow || '—'}</p>
                  <p>{activePlanning.summary?.reason || 'Waiting for a current planning decision.'}</p>
                  <p>Confidence {activePlanning.summary?.confidence || '—'}{activePlanning.summary?.nextKeyDay ? ` • Next key day ${activePlanning.summary.nextKeyDay}` : ''}</p>
                  {activePlanning.summary?.risks?.length ? (
                    <p>Risk: {activePlanning.summary.risks[0]}</p>
                  ) : null}
                </div>
                <div className="status-item training-plan-week-decision-panel">
                  <strong>Active-week edits • draft bridge</strong>
                  <p>{currentWeekBridge?.draftBridgeLabel || 'Remaining editable slots in this week are not available yet.'}</p>
                  <p>{currentWeekBridge?.liveWindowLabel || 'Live today / tomorrow guidance stays runtime-backed.'}</p>
                  <p>{currentWeekBridge?.remainingDays.length ? `Editable remaining days: ${currentWeekBridge.remainingDays.join(', ')}` : 'No remaining editable days in this week.'}</p>
                  <p>{currentWeekBridge?.missedSessions.length ? `Missed draft slots detected: ${currentWeekBridge.missedSessions.length}` : 'No missed draft slots detected in this week so far.'}</p>
                  <p>{currentWeekBridge?.recommendationText || 'Waiting for a current-week bridge recommendation.'}</p>
                  <p>Remaining week budget: {currentWeekBridge ? `${currentWeekBridge.remainingWeekHours.toFixed(1)} h` : '—'} • Remaining key slots: {currentWeekBridge?.remainingQualityBudget ?? '—'}</p>
                  <p>{currentWeekBridge?.recommendedNextKeyDay ? `Recommended next key day: ${currentWeekBridge.recommendedNextKeyDay}` : 'Recommended next key day is still being resolved.'}</p>
                  <p>{currentWeekBridge?.plannedSoFar.length ? `Draft slots already in play: ${currentWeekBridge.plannedSoFar.join(' | ')}` : 'No draft slots have landed earlier in this week.'}</p>
                  <p>{currentWeekBridge?.completedSoFar.length ? `Completed this week: ${currentWeekBridge.completedSoFar.join(' | ')}` : 'No completed work has been imported into this week yet.'}</p>
                  <p>These actions rewrite only the remaining draft bridge for this week. Completed work and the live today / tomorrow call stay runtime-backed.</p>
                  <div className="button-row">
                    <form action="/api/planner/month/replan" method="post">
                      <input type="hidden" name="draftId" value={latestDraft.id} />
                      <input type="hidden" name="scenario" value="missed_session" />
                      <button type="submit">repair missed draft slot</button>
                    </form>
                    <form action="/api/planner/month/replan" method="post">
                      <input type="hidden" name="draftId" value={latestDraft.id} />
                      <input type="hidden" name="scenario" value="fatigued" />
                      <button type="submit">cut current-week bridge</button>
                    </form>
                    <form action="/api/planner/month/replan" method="post">
                      <input type="hidden" name="draftId" value={latestDraft.id} />
                      <input type="hidden" name="scenario" value="fresher" />
                      <button type="submit">spend extra freshness</button>
                    </form>
                    <form action="/api/planner/month/replan" method="post">
                      <input type="hidden" name="draftId" value={latestDraft.id} />
                      <input type="hidden" name="scenario" value="reduce_load" />
                      <button type="submit">reduce bridge load</button>
                    </form>
                    <form action="/api/planner/month/replan" method="post">
                      <input type="hidden" name="draftId" value={latestDraft.id} />
                      <input type="hidden" name="scenario" value="increase_specificity" />
                      <button type="submit">make bridge more race-like</button>
                    </form>
                  </div>
                </div>
                <div className="training-plan-calendar-toolbar__actions">
                  {!isCalendarMode ? (
                    <a href={appRoutes.calendar} className="button-secondary button-link">Open compact calendar</a>
                  ) : (
                    <a href={appRoutes.plan} className="button-secondary button-link">Back to plan builder</a>
                  )}
                  <a href={appRoutes.dashboard} className="button-secondary button-link">Back to dashboard</a>
                  <details className="training-plan-inline-panel">
                    <summary title="More month actions">⋯</summary>
                    <div className="training-plan-inline-panel__content">
                      <div className="training-plan-calendar-publish-copy">
                        <strong>Publish future draft layer</strong>
                        <p>Use after your future-week moves are final. Active week remains live runtime-backed.</p>
                      </div>
                      <form action="/api/planner/month/publish" method="post">
                        <input type="hidden" name="draftId" value={latestDraft.id} />
                        <button type="submit">Publish plan</button>
                      </form>
                    </div>
                  </details>
                </div>
              </div>
              <TrainingPlanCalendar draftId={latestDraft.id} weeks={(displayedWeeks || latestDraft.weeks) as any} today={planner.live?.today || ''} />
              <details className="training-plan-compare-panel">
                <summary>Month details</summary>
                <div className="training-plan-comparison-grid training-plan-comparison-grid-compact">
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
                <div className="training-plan-category-grid">
                  {comparePayload.categoryComparison.map((item) => (
                    <div key={item.category} className="status-item">
                      <strong>{item.category}</strong>
                      <p>Recent: {item.recentSessions} sessions / {fmtHours(item.recentHours)}</p>
                      <p>Planned: {item.plannedSessions} sessions / {fmtHours(item.plannedHours)}</p>
                      <p>Delta sessions: {item.deltaSessions >= 0 ? '+' : ''}{item.deltaSessions}</p>
                    </div>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <p>No monthly draft saved yet. Generate draft to create your first 4-week block.</p>
          )}
        </AppCard>
      </section>
    </AppPageShell>
  );
}
