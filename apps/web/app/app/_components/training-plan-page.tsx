import { redirect } from 'next/navigation';

import { appRoutes } from '../../../lib/routes';
import {
  buildCurrentWeekReplanPayload,
  buildGoalPayload,
  buildMonthlyPlannerComparePayload,
  buildMonthlyPlannerContextPayload,
  buildPlannerTruthSummaryPayload,
  buildPlanningRecommendationPayload,
  buildPowerProfilePayload,
  buildTodayReconciliationPayload,
  buildAdaptationPayload,
  getActivePlanningContext,
  getAuthorizedPlannerLiveContext,
  replaceCurrentWeekWithRuntime,
} from '../../../lib/server/planner-data';
import { getLatestMonthlyPlanDraft, getLatestMonthlyPlanInput, getUserGoalEntries, listPlanningEvents } from '../../../lib/server/planner-customization';
import { getLatestIntervalsConnectionRecord } from '../../../lib/server/auth-store';
import { getSessionUserId } from '../../../lib/server/session';
import { getLatestSnapshotForUser } from '../../../lib/server/sync-store';
import { AppCard, AppHero, AppPageShell } from './material-shell';
import { TrainingPlanCalendar } from './training-plan-calendar';
import { CurrentWeekRepairPanelClient } from './current-week-repair-panel-client';
import { TrainingPlanStatefulBuilderClient } from './training-plan-stateful-builder-client';

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

function planEventTypeLabel(type: string) {
  switch (type) {
    case 'A_race': return 'A race';
    case 'B_race': return 'B race';
    case 'C_race': return 'C race';
    case 'training_camp': return 'Camp';
    case 'travel': return 'Travel';
    case 'blackout': return 'Blackout';
    default: return type;
  }
}

function shiftIsoDate(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
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
  const planEvents = await listPlanningEvents(userId);
  const latestConnection = await getLatestIntervalsConnectionRecord(userId);
  const latestSnapshot = latestConnection ? await getLatestSnapshotForUser(userId, latestConnection.id) : null;
  const liveSyncStamp = formatLiveSyncStamp(latestSnapshot?.capturedAt || null);

  const goalEntries = await getUserGoalEntries(userId);
  const latestInput = await getLatestMonthlyPlanInput(userId);
  let latestDraft = await getLatestMonthlyPlanDraft(userId);
  const currentDirection = buildGoalPayload(planner.live, goalEntries).goalHistory[0]?.title;
  const today = planner.live?.today || new Date().toISOString().slice(0, 10);
  const currentMonthStart = `${today.slice(0, 8)}01`;
  const staleDraftReason = !latestInput
    ? null
    : !latestDraft
      ? 'No draft saved yet from the latest planner inputs.'
      : latestDraft.monthStart !== currentMonthStart
        ? 'Saved draft started in an earlier month and needs an explicit refresh.'
        : (latestDraft.updatedAt || '').slice(0, 10) < today
          ? 'Saved draft is older than today’s live context.'
          : null;
  const draftNeedsExplicitRefresh = Boolean(staleDraftReason);

  const contextPayload = buildMonthlyPlannerContextPayload(planner.live, currentDirection, latestInput ? {
    sourceWindowDays: latestInput.sourceWindowDays,
    ignoreSickWeek: latestInput.ignoreSickWeek,
    ignoreVacationWeek: latestInput.ignoreVacationWeek,
    excludeNonPrimarySport: latestInput.excludeNonPrimarySport,
  } : undefined);
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
  const currentWeekReplan = buildCurrentWeekReplanPayload(planner.live, latestDraft ? {
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
  } : null, latestInput ? {
    objective: latestInput.objective,
    ambition: latestInput.ambition,
    currentDirection,
    mustFollow: { maxWeeklyHours: latestInput.mustFollow.maxWeeklyHours },
  } : undefined);
  const truthSummary = latestDraft ? await buildPlannerTruthSummaryPayload(userId, latestDraft, planner.live) : null;
  const isCalendarMode = mode === 'calendar';
  const heroTitle = isCalendarMode ? 'Calendar' : 'Plan';
  const heroEyebrow = isCalendarMode ? 'Calendar' : 'Plan';
  const heroDescription = isCalendarMode
    ? 'Live week first. Future weeks stay editable.'
    : 'Live week first. Future weeks stay editable.';
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
  const publishStateLabel = latestDraft?.publishState === 'published'
    ? 'Future weeks published locally'
    : 'Draft only';
  const publishStateDetail = latestDraft?.publishState === 'published'
    ? 'Runtime week stays live while future draft weeks are locally published.'
    : 'Runtime week stays live until you publish the future draft.';
  const publishSyncLabel = latestDraft?.weeks.some((week) => week.workouts.some((workout) => workout.status === 'published_intervals'))
    ? 'Externally synced'
    : 'Local only';
  const recommendationPayload = buildPlanningRecommendationPayload(planner.live, currentDirection, latestInput ? {
    sourceWindowDays: latestInput.sourceWindowDays,
    ignoreSickWeek: latestInput.ignoreSickWeek,
    ignoreVacationWeek: latestInput.ignoreVacationWeek,
    excludeNonPrimarySport: latestInput.excludeNonPrimarySport,
    objective: latestInput.objective,
    mustFollow: { maxWeeklyHours: latestInput.mustFollow.maxWeeklyHours },
  } : undefined);
  const selectedObjectiveValue = latestInput?.objective || recommendationPayload.primary.objective;
  const selectedDirectionLabel = objectiveOptions.find((item) => item.value === selectedObjectiveValue)?.label || selectedObjectiveValue || 'No direction selected yet';
  const selectedRecommendation = latestInput?.selectedRecommendation || (latestInput
    ? {
        source: 'manual' as const,
        title: selectedDirectionLabel,
        objective: selectedObjectiveValue as 'repeatability' | 'threshold_support' | 'race_specificity' | 'aerobic_support' | 'rebuild' | 'consistency' | 'taper',
        reason: 'Builder inputs are saved, but this direction was not selected from the recommendation cards.',
        confidence: undefined,
      }
    : undefined);
  const draftOriginLabel = latestDraft?.assumptions.selectedRecommendationTitle || selectedRecommendation?.title || selectedDirectionLabel;
  const latestRuntimeRepair = truthSummary?.recentEvents.find((event) => event.source === 'planner_runtime' && /Current week repaired/i.test(event.title));
  const latestRuntimeRepairTarget = latestRuntimeRepair?.matchedPlannedWorkoutLabel || 'No linked planned slot';
  const completedTodayRows = (planner.live?.recent_rows || []).filter((row) => row.start_date_local.slice(0, 10) === today);
  const completedTodaySummary = completedTodayRows.map((row) => row.summary?.short_label || row.session_type || row.name || 'Completed').slice(0, 2).join(' • ');
  const todayReconciliation = buildTodayReconciliationPayload({
    decision: activePlanning.todayDecision,
    truth: truthSummary,
  });
  const keySessionProtected = Boolean(activePlanning.todayDecision?.recommendedNextKeyDay || currentWeekReplan.recommendedNextKeyDay);
  const protectedKeyDayLabel = activePlanning.todayDecision?.recommendedNextKeyDay || currentWeekReplan.recommendedNextKeyDay || 'Still resolving';
  const tomorrowFallbackIfTodayMisses = todayReconciliation.tomorrowIfTodaySlips;
  const tomorrowIfTodayLands = todayReconciliation.tomorrowIfTodayLands;
  const protectionOutcome = keySessionProtected ? `Key work stays protected for ${protectedKeyDayLabel}.` : 'Key work is no longer clearly protected.';
  const plannedVsDoneMismatch = todayReconciliation.mismatch;
  const mismatchConsequence = todayReconciliation.tomorrowConsequence;
  const draftNutshellTitle = latestInput?.selectedRecommendation?.title || latestDraft?.assumptions.selectedRecommendationTitle || draftOriginLabel;
  const draftProtectedLine = latestDraft?.weeks[0]?.rationale.protected || latestDraft?.weeks[0]?.rationale.carriedForward || 'Protect the strongest recent support while keeping the month repeatable.';
  const draftAimLine = latestDraft?.weeks[0]?.rationale.mainAim || comparePayload.summary;
  const recentFocusSummary = contextPayload.statusQuo.recentFocus.slice(0, 2).join(' • ') || 'No clear recent focus yet';
  const nextEvent = planEvents[0] || null;
  const upcomingEvents = planEvents.slice(0, 2);
  const plannerWorkspaceCards = {
    currentWeekRail: 'Current-week summary',
    monthWorkspace: 'Month workspace',
    builderPublish: 'Build and review',
    builderPublishCopy: 'Keep the month simple: choose direction, set limits, review the draft.',
  };

  return (
    <AppPageShell>
      <AppHero
        eyebrow={heroEyebrow}
        title={heroTitle}
        description={heroDescription}
      />

      {(notice || moveConflict || draftNeedsExplicitRefresh) ? (
        <section className="mt-18">
          {notice ? (
            <div className="status-list compact-status-list">
              <div className="status-item">
                <strong>Success</strong>
                <p>{notice}</p>
              </div>
            </div>
          ) : null}
          {draftNeedsExplicitRefresh ? (
            <div className="training-plan-stale-draft-banner">
              <div>
                <strong>Draft is stale: {staleDraftReason}</strong>
                <p>Review stays locked until refresh.</p>
              </div>
              <form action="/api/planner/month/draft" method="post" className="button-row">
                <input type="hidden" name="action" value="refresh_latest_input" />
                <button type="submit">Refresh draft</button>
              </form>
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
        <section className="training-plan-workspace-shell mt-18">
          <div className="training-plan-workspace-compact-grid">
              <div className="training-plan-workspace-rail">
              <AppCard className="training-plan-workspace-card training-plan-current-week-panel">
                <div className="kicker">{plannerWorkspaceCards.currentWeekRail}</div>
                <div className="training-plan-current-week-panel__header">
                  <div>
                    <h3>What should actually happen</h3>
                    <p className="training-plan-current-week-panel__summary">{currentWeekReplan.recommendationText}</p>
                  </div>
                </div>
                <div className="training-plan-current-week-panel__anchor-grid">
                  <span className="training-plan-mini-fact training-plan-current-week-panel__anchor-tile">
                    <strong>Planned today</strong>
                    {activePlanning.todayDecision?.plannedForToday || activePlanning.summary?.plannedToday || 'Pending'}
                  </span>
                  <span className="training-plan-mini-fact training-plan-current-week-panel__anchor-tile">
                    <strong>Planned tomorrow</strong>
                    {activePlanning.todayDecision?.plannedForTomorrow || activePlanning.summary?.plannedTomorrow || '—'}
                  </span>
                  <span className="training-plan-mini-fact training-plan-current-week-panel__anchor-tile training-plan-current-week-panel__anchor-tile-primary">
                    <strong>What should actually happen</strong>
                    {activePlanning.todayDecision?.actualRecommendationForToday || activePlanning.summary?.actualToday || currentWeekReplan.recommendationText}
                  </span>
                </div>
                <div className="training-plan-current-week-panel__meta-grid">
                  <span className="training-plan-mini-fact training-plan-current-week-panel__meta-tile"><strong>Freshness</strong>{contextPayload.currentState.freshnessSummary}</span>
                  <span className="training-plan-mini-fact training-plan-current-week-panel__meta-tile"><strong>Next key move</strong>{protectedKeyDayLabel}</span>
                  <span className="training-plan-mini-fact training-plan-current-week-panel__meta-tile"><strong>Updated</strong>{liveSyncStamp}</span>
                </div>
              </AppCard>

              <AppCard className="training-plan-workspace-card">
                <div className="kicker">Focus</div>
                <h3>Focus</h3>
                <p>{draftOriginLabel}</p>
                <div className="training-plan-mini-facts">
                  <span className="training-plan-mini-fact"><strong>Next event</strong>{nextEvent ? `${nextEvent.title} • ${nextEvent.date}` : 'No events added yet'}</span>
                  <span className="training-plan-mini-fact"><strong>Recent focus</strong>{recentFocusSummary}</span>
                </div>
                <form action="/api/planner/month/events" method="post" className="training-plan-top-strip__actions">
                  <input type="hidden" name="returnTo" value={appRoutes.plan} />
                  <input name="title" type="text" placeholder="Add race or event" aria-label="Add race or event" />
                  <input name="date" type="date" aria-label="Event date" />
                  <input type="hidden" name="type" value="B_race" />
                  <input type="hidden" name="priority" value="support" />
                  <button type="submit">Add event</button>
                  <a href={appRoutes.planRaces} className="button-secondary button-link">Edit events</a>
                </form>
                <div className="training-plan-mini-facts">
                  {upcomingEvents.length ? upcomingEvents.map((event) => (
                    <div key={event.id} className="training-plan-mini-fact training-plan-focus-event-card">
                      <strong>{planEventTypeLabel(event.type)}</strong>
                      <span>{event.title} • {event.date}</span>
                      <div className="training-plan-focus-event-card__quick-row">
                        <form action="/api/planner/month/events" method="post" className="training-plan-focus-event-card__quick-form">
                          <input type="hidden" name="action" value="update" />
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="returnTo" value={appRoutes.plan} />
                          <input type="hidden" name="title" value={event.title} />
                          <input type="hidden" name="date" value={event.date} />
                          <input type="hidden" name="durationHours" value={event.durationHours ?? ''} />
                          <input type="hidden" name="notes" value={event.notes || ''} />
                          <div className="training-plan-focus-event-card__quick-pills">
                            {(['A_race', 'B_race', 'C_race'] as const).map((type) => (
                              <button key={type} type="submit" name="type" value={type} className={event.type === type ? 'button-secondary button-link' : 'button-secondary'}>
                                {type === 'A_race' ? 'A' : type === 'B_race' ? 'B' : 'C'}
                              </button>
                            ))}
                            <input type="hidden" name="priority" value={event.priority} />
                          </div>
                        </form>
                        <form action="/api/planner/month/events" method="post" className="training-plan-focus-event-card__quick-form">
                          <input type="hidden" name="action" value="update" />
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="returnTo" value={appRoutes.plan} />
                          <input type="hidden" name="title" value={event.title} />
                          <input type="hidden" name="date" value={event.date} />
                          <input type="hidden" name="type" value={event.type} />
                          <input type="hidden" name="durationHours" value={event.durationHours ?? ''} />
                          <input type="hidden" name="notes" value={event.notes || ''} />
                          <div className="training-plan-focus-event-card__quick-pills">
                            {(['primary', 'support', 'optional'] as const).map((priority) => (
                              <button key={priority} type="submit" name="priority" value={priority} className={event.priority === priority ? 'button-secondary button-link' : 'button-secondary'}>
                                {priority === 'primary' ? 'Key' : priority === 'support' ? 'Support' : 'Optional'}
                              </button>
                            ))}
                          </div>
                        </form>
                        <form action="/api/planner/month/events" method="post" className="training-plan-focus-event-card__quick-form">
                          <input type="hidden" name="action" value="update" />
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="returnTo" value={appRoutes.plan} />
                          <input type="hidden" name="title" value={event.title} />
                          <input type="hidden" name="type" value={event.type} />
                          <input type="hidden" name="priority" value={event.priority} />
                          <input type="hidden" name="durationHours" value={event.durationHours ?? ''} />
                          <input type="hidden" name="notes" value={event.notes || ''} />
                          <div className="training-plan-focus-event-card__quick-pills">
                            <button type="submit" name="date" value={shiftIsoDate(event.date, -1)} className="button-secondary">−1d</button>
                            <button type="submit" name="date" value={shiftIsoDate(event.date, 1)} className="button-secondary">+1d</button>
                          </div>
                        </form>
                      </div>
                      <details className="training-plan-inline-panel training-plan-inline-panel-event">
                        <summary title="Edit event">⋯</summary>
                        <div className="training-plan-inline-panel__content">
                          <form action="/api/planner/month/events" method="post" className="training-plan-inline-event-form">
                            <input type="hidden" name="action" value="update" />
                            <input type="hidden" name="eventId" value={event.id} />
                            <input type="hidden" name="returnTo" value={appRoutes.plan} />
                            <label>
                              <span>Title</span>
                              <input name="title" type="text" defaultValue={event.title} />
                            </label>
                            <label>
                              <span>Date</span>
                              <input name="date" type="date" defaultValue={event.date} />
                            </label>
                            <label>
                              <span>Type</span>
                              <select name="type" defaultValue={event.type}>
                                <option value="A_race">A race</option>
                                <option value="B_race">B race</option>
                                <option value="C_race">C race</option>
                                <option value="training_camp">Training camp</option>
                                <option value="travel">Travel</option>
                                <option value="blackout">Blackout</option>
                              </select>
                            </label>
                            <label>
                              <span>Priority</span>
                              <select name="priority" defaultValue={event.priority}>
                                <option value="primary">Primary</option>
                                <option value="support">Support</option>
                                <option value="optional">Optional</option>
                              </select>
                            </label>
                            <label>
                              <span>Hours</span>
                              <input name="durationHours" type="number" min="0" step="0.5" defaultValue={event.durationHours ?? ''} />
                            </label>
                            <label>
                              <span>Notes</span>
                              <input name="notes" type="text" defaultValue={event.notes || ''} />
                            </label>
                            <button type="submit">Save event</button>
                          </form>
                          <form action="/api/planner/month/events" method="post">
                            <input type="hidden" name="action" value="remove" />
                            <input type="hidden" name="eventId" value={event.id} />
                            <input type="hidden" name="returnTo" value={appRoutes.plan} />
                            <button type="submit" className="button-secondary">Remove</button>
                          </form>
                        </div>
                      </details>
                    </div>
                  )) : (
                    <span className="training-plan-mini-fact"><strong>Event flow</strong>Add the next race here, then refine details only if needed.</span>
                  )}
                </div>
              </AppCard>
            </div>

                <div className="training-plan-workspace-main">
              <AppCard className="training-plan-card training-plan-card-flat training-plan-workspace-card training-plan-builder-panel training-plan-builder-panel-premium">
            <div className="training-plan-quick-builder">
                <div className="training-plan-quick-builder__header">
                    <div>
                      <div className="kicker">{plannerWorkspaceCards.builderPublish}</div>
                      <h3>Month direction</h3>
                      <p>{plannerWorkspaceCards.builderPublishCopy}</p>
                    </div>
                </div>

                  {latestDraft ? (
                    <details className="training-plan-compare-panel">
                      <summary>Today check</summary>
                      <div className="training-plan-current-week-panel__trace training-plan-mini-facts">
                        {[
                          activePlanning.todayDecision?.reasonSummary,
                          activePlanning.todayDecision?.decisionBasis?.weeklyBalance,
                        ].filter(Boolean).slice(0, 2).map((reason) => (
                          <span key={reason} className="training-plan-mini-fact">{reason}</span>
                        ))}
                        {((activePlanning.todayDecision?.risks?.length
                          ? activePlanning.todayDecision.risks
                          : ['No immediate runtime risk flags.']).slice(0, 1)).map((risk) => (
                          <span key={risk} className="training-plan-mini-fact training-plan-mini-fact-warning">{risk}</span>
                        ))}
                      </div>
                      <div className="training-plan-current-week-panel__meta-grid">
                        <span className="training-plan-mini-fact training-plan-current-week-panel__meta-tile"><strong>Done so far</strong>{todayReconciliation.doneLabel || completedTodaySummary || 'Nothing completed yet'}</span>
                        <span className="training-plan-mini-fact training-plan-current-week-panel__meta-tile"><strong>Mismatch</strong>{plannedVsDoneMismatch ? `Yes • ${todayReconciliation.mismatchReason}` : 'No • prescription still matches execution'}</span>
                        <span className="training-plan-mini-fact training-plan-current-week-panel__meta-tile"><strong>Next key day</strong>{currentWeekReplan.recommendedNextKeyDay}</span>
                      </div>
                      <div className="training-plan-current-week-panel__consequence training-plan-current-week-panel__support-card status-item">
                        <strong>If today slips</strong>
                        <p>Tomorrow falls back toward {tomorrowFallbackIfTodayMisses} instead of {tomorrowIfTodayLands}.</p>
                        <span>{mismatchConsequence}</span>
                        <span>{protectionOutcome}</span>
                      </div>
                      {latestRuntimeRepair ? (
                        <div className="training-plan-current-week-panel__latest-repair training-plan-current-week-panel__support-card status-item">
                          <strong>Latest runtime repair</strong>
                          <p>{latestRuntimeRepair.title}</p>
                          <span>{latestRuntimeRepair.date} • {latestRuntimeRepair.detail}</span>
                          <span>Target planned slot: {latestRuntimeRepairTarget}</span>
                        </div>
                      ) : null}
                      <CurrentWeekRepairPanelClient
                        draftId={latestDraft.id}
                        initialPreviews={currentWeekReplan.scenarioPreviews as any}
                        initialDraftRevision={latestDraft.revision || 0}
                      />
                    </details>
                  ) : null}

              <TrainingPlanStatefulBuilderClient
                objectiveOptions={objectiveOptions}
                recommendationPrimary={recommendationPayload.primary}
                recommendationAlternatives={recommendationPayload.alternatives}
                initialSelection={selectedRecommendation ? {
                  source: selectedRecommendation.source,
                  title: selectedRecommendation.title,
                  objective: selectedRecommendation.objective,
                  reason: selectedRecommendation.reason,
                  confidence: selectedRecommendation.confidence,
                } : undefined}
                initialValues={{
                  objective: latestInput?.objective || recommendationPayload.primary.objective,
                  ambition: latestInput?.ambition || 'balanced',
                  maxWeeklyHours: latestInput?.mustFollow.maxWeeklyHours || 10.5,
                  maxWeekdayMinutes: latestInput?.mustFollow.maxWeekdayMinutes || 75,
                  restDay: latestInput?.preferences.restDay || 'Saturday',
                  restDaysPerWeek: latestInput?.preferences.restDaysPerWeek || 1,
                  longRideDay: latestInput?.preferences.longRideDay || 'Sunday',
                  unavailableDates: latestInput?.mustFollow.unavailableDates || [],
                  noDoubles: latestInput?.mustFollow.noDoubles ?? true,
                  noBackToBackHardDays: latestInput?.mustFollow.noBackToBackHardDays ?? true,
                  useLast28DaysOnly: latestInput?.sourceWindowDays === 28,
                  ignoreSickWeek: latestInput?.ignoreSickWeek ?? false,
                  ignoreVacationWeek: latestInput?.ignoreVacationWeek ?? false,
                  excludeNonPrimarySport: latestInput?.excludeNonPrimarySport ?? false,
                  successMarkers: latestInput?.successMarkers || [],
                  note: latestInput?.note || '',
                }}
                successOptions={successOptions}
              />
            </div>
          </AppCard>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-18 training-plan-top-strip__actions">
          <a href={appRoutes.plan} className="button-secondary button-link">Back to plan builder</a>
        </section>
      )}

      <section id="review" className="training-plan-review-stack mt-18 training-plan-workspace-main">
        <AppCard className="training-plan-card training-plan-card-fullwidth training-plan-workspace-card training-plan-publish-panel training-plan-analysis-panel">
              <div className="planning-workspace-section__header planning-workspace-section__header-review training-plan-workspace-calendar-header">
                <div>
                      <div className="kicker">{plannerWorkspaceCards.monthWorkspace}</div>
                      <h2>Generated month</h2>
                      <p>Future draft</p>
                      <p>{plannerWorkspaceCards.builderPublishCopy}</p>
{nextFourWeekRange ? <p className="training-plan-range-headline">{nextFourWeekRange}</p> : null}
                </div>
                {latestDraft ? null : null}
              </div>
              {latestDraft ? (
                    <>
                      <div className="training-plan-workspace-calendar-shell">
                        <TrainingPlanCalendar
                            draftId={latestDraft.id}
                            draftRevision={latestDraft.revision || 0}
                            weeks={(displayedWeeks || latestDraft.weeks) as any}
                            today={planner.live?.today || ''}
                            planEvents={planEvents}
                            reconciliationEvents={truthSummary?.recentEvents || []}
                          />
                  <div className="training-plan-top-strip__actions mt-18">
                    <span className="chip">Built from: {latestDraft.assumptions?.selectedRecommendationTitle || latestInput?.selectedRecommendation?.title || latestInput?.objective || 'latest planner inputs'} • {fmtHours(latestInput?.mustFollow.maxWeeklyHours || 10.5)} • {latestInput?.preferences.restDay || 'Saturday'} rest</span>
                    <details className="training-plan-inline-panel">
                      <summary title="More month actions">⋯</summary>
                      <div className="training-plan-inline-panel__content">
                        <div className="training-plan-calendar-publish-copy">
                          <strong>Publish future draft</strong>
                          <p>{publishStateDetail}</p>
                        </div>
                        <span className="chip">Publish state: {publishStateLabel}</span>
                        <span className="chip">Sync: {publishSyncLabel}</span>
                        {!isCalendarMode ? (
                          <a href={appRoutes.calendar} className="button-secondary button-link">Calendar</a>
                        ) : (
                          <a href={appRoutes.plan} className="button-secondary button-link">Builder</a>
                        )}
                        <a href={appRoutes.planRaces} className="button-secondary button-link">Race calendar</a>
                        <form action="/api/planner/month/publish" method="post">
                          <input type="hidden" name="draftId" value={latestDraft.id} />
                          <button type="submit">Publish future draft</button>
                        </form>
                      </div>
                    </details>
                  </div>
                  <div className="status-item" style={{ marginTop: 12 }}>
                    <strong>Draft in a nutshell</strong>
                    <p>{draftNutshellTitle}</p>
                    <span>{draftProtectedLine}</span>
                    <span>{draftAimLine}</span>
                  </div>
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
                  </details>
              </div>
            </>
          ) : (
            <p>No monthly draft saved yet. Generate draft to create your first 4-week block.</p>
          )}
        </AppCard>
      </section>
    </AppPageShell>
  );
}
