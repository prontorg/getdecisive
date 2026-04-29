import { redirect } from 'next/navigation';

import { appRoutes } from '../../../lib/routes';
import {
  buildCurrentWeekReplanPayload,
  buildGoalPayload,
  buildMonthlyPlannerComparePayload,
  buildMonthlyPlannerContextPayload,
  buildPlannerBlockPayload,
  buildPlannerTruthSummaryPayload,
  buildPlannerWeekPayload,
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

function compareIntentLabel(category: string) {
  switch (category) {
    case 'threshold_support': return 'Threshold intent';
    case 'repeatability': return 'Repeatability intent';
    case 'race_like': return 'Race-specific intent';
    case 'endurance': return 'Endurance intent';
    case 'recovery': return 'Recovery intent';
    case 'rest': return 'Rest intent';
    default: return category;
  }
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
const draftStatusLabel = latestDraft
    ? latestDraft.publishState === 'published'
      ? 'Draft saved and locally published'
      : 'Draft saved locally and still editable'
    : 'No draft saved yet';
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
  const weekPayload = buildPlannerWeekPayload(planner.live);
  const blockPayload = buildPlannerBlockPayload(planner.live);
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
  const matchedTodaySummary = truthSummary?.currentWeekToday.matchedPlannedWorkoutLabels.join(' • ') || 'No matched planned slot yet';
  const unmatchedTodaySummary = truthSummary?.currentWeekToday.unmatchedCompletedLabels.join(' • ') || 'No unmatched completed work';
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
  const currentWeekTruthRows = truthSummary?.currentWeekTruthRows || [];
  const recentMutationEvents = truthSummary?.recentEvents || [];
  const slotDiffSummary = recentMutationEvents[0]?.diffSummary || recentMutationEvents[0]?.detail || 'No exact slot change recorded yet.';
  const plannerWorkspaceCards = {
    currentWeekRail: 'Current-week summary',
    monthWorkspace: 'Month workspace',
    builderPublish: 'Build and review',
    builderPublishCopy: 'Keep the month simple: choose direction, set limits, review the draft.',
    builderPolishTagline: 'Keep today, tomorrow, and the next key move visible.',
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
              <AppCard className="training-plan-workspace-card">
                <div className="kicker">{plannerWorkspaceCards.currentWeekRail}</div>
                <h3>What should actually happen</h3>
                <p>{currentWeekReplan.recommendationText}</p>
                <div className="training-plan-mini-facts">
                  <span className="training-plan-mini-fact"><strong>Planned today</strong>{activePlanning.todayDecision?.plannedForToday || activePlanning.summary?.plannedToday || 'Pending'}</span>
                  <span className="training-plan-mini-fact"><strong>Planned tomorrow</strong>{activePlanning.todayDecision?.plannedForTomorrow || activePlanning.summary?.plannedTomorrow || '—'}</span>
                  <span className="training-plan-mini-fact"><strong>What should actually happen</strong>{activePlanning.todayDecision?.actualRecommendationForToday || activePlanning.summary?.actualToday || currentWeekReplan.recommendationText}</span>
                  <span className="training-plan-mini-fact"><strong>Freshness</strong>{contextPayload.currentState.freshnessSummary}</span>
                  <span className="training-plan-mini-fact"><strong>Next key move</strong>{protectedKeyDayLabel}</span>
                  <span className="training-plan-mini-fact"><strong>Updated</strong>{liveSyncStamp}</span>
                </div>
              </AppCard>

              <AppCard className="training-plan-workspace-card">
                <div className="kicker">Goals and races</div>
                <h3>Goals and races</h3>
                <p>{draftOriginLabel}</p>
                <div className="training-plan-mini-facts">
                  <span className="training-plan-mini-fact"><strong>Upcoming races</strong>{planEvents.length ? String(planEvents.length) : '0'}</span>
                  <span className="training-plan-mini-fact"><strong>Next event</strong>{planEvents[0] ? `${planEvents[0].title} • ${planEvents[0].date}` : 'No events added yet'}</span>
                  <span className="training-plan-mini-fact"><strong>Recent focus</strong>{contextPayload.statusQuo.recentFocus.join(' • ')}</span>
                </div>
                <div className="training-plan-top-strip__actions">
                  <a href={appRoutes.planRaces} className="button-secondary button-link button-secondary-premium">Open race calendar</a>
                </div>
              </AppCard>
            </div>

                <div className="training-plan-workspace-main">
              <AppCard className="training-plan-card training-plan-card-flat training-plan-workspace-card training-plan-builder-panel training-plan-builder-panel-premium">
            <div className="training-plan-quick-builder">
                <div className="training-plan-quick-builder__header">
                    <div>
                      <div className="kicker">{plannerWorkspaceCards.builderPublish}</div>
                      <h3>Parameters</h3>
                      <p>{plannerWorkspaceCards.builderPublishCopy}</p>
                      <p className="training-plan-quick-builder__tagline">{plannerWorkspaceCards.builderPolishTagline}</p>
                    </div>
<div className="chip-row planning-recommendation-chip-row">
                    <span className="chip">Draft: {draftStatusLabel}</span>
                  </div>
                </div>

              {latestDraft ? (
                <div className="training-plan-current-week-panel training-plan-current-week-panel-premium">
                  <div className="training-plan-current-week-panel__header">
                    <div>
                      <div className="kicker">Current week</div>
                      <strong>What should actually happen this week</strong>
                    </div>
                    <div className="chip-row">
                      <span className="chip">Focus: {currentWeekReplan.recommendedFocus.replace('_', ' ')}</span>
                      <span className="chip">{currentWeekReplan.remainingWeekHours.toFixed(1)} h left</span>
                    </div>
                  </div>
                  <div className="training-plan-current-week-panel__decision-grid training-plan-current-week-panel__fact-grid">
                    <span className="training-plan-mini-fact training-plan-current-week-panel__fact-tile"><strong>Planned today</strong>{activePlanning.todayDecision?.plannedForToday || activePlanning.summary?.plannedToday || 'Pending'}</span>
                    <span className="training-plan-mini-fact training-plan-current-week-panel__fact-tile"><strong>What should actually happen</strong>{activePlanning.todayDecision?.actualRecommendationForToday || activePlanning.summary?.actualToday || currentWeekReplan.recommendationText}</span>
                    <span className="training-plan-mini-fact training-plan-current-week-panel__fact-tile"><strong>Planned tomorrow</strong>{activePlanning.todayDecision?.plannedForTomorrow || activePlanning.summary?.plannedTomorrow || '—'}</span>
                    <span className="training-plan-mini-fact training-plan-current-week-panel__fact-tile"><strong>Tomorrow if today lands</strong>{activePlanning.todayDecision?.likelyTomorrowAfterToday || activePlanning.summary?.likelyTomorrow || '—'}</span>
                  </div>
                  <details className="training-plan-compare-panel">
                    <summary>Repair and reconciliation</summary>
                    <div className="training-plan-current-week-panel__trace training-plan-mini-facts">
                      {[
                        activePlanning.todayDecision?.reasonSummary,
                        activePlanning.todayDecision?.decisionBasis?.weeklyBalance,
                      ].filter(Boolean).slice(0, 2).map((reason) => (
                        <span key={reason} className="training-plan-mini-fact">{reason}</span>
                      ))}
                      {((activePlanning.todayDecision?.risks?.length
                        ? activePlanning.todayDecision.risks
                        : ['No immediate runtime risk flags.']).slice(0, 2)).map((risk) => (
                        <span key={risk} className="training-plan-mini-fact training-plan-mini-fact-warning">{risk}</span>
                      ))}
                    </div>
                    <div className="training-plan-current-week-panel__fact-grid">
                      <span className="training-plan-mini-fact training-plan-current-week-panel__fact-tile"><strong>Done so far</strong>{todayReconciliation.doneLabel || completedTodaySummary || 'Nothing completed yet'}</span>
                      <span className="training-plan-mini-fact training-plan-current-week-panel__fact-tile"><strong>Mismatch</strong>{plannedVsDoneMismatch ? `Yes • ${todayReconciliation.mismatchReason}` : 'No • prescription still matches execution'}</span>
                      <span className="training-plan-mini-fact training-plan-current-week-panel__fact-tile"><strong>Matched planned slot</strong>{matchedTodaySummary}</span>
                      <span className="training-plan-mini-fact training-plan-current-week-panel__fact-tile"><strong>Unmatched done</strong>{unmatchedTodaySummary}</span>
                      <span className="training-plan-mini-fact training-plan-current-week-panel__fact-tile"><strong>Next key day</strong>{currentWeekReplan.recommendedNextKeyDay}</span>
                      <span className="training-plan-mini-fact training-plan-current-week-panel__fact-tile"><strong>Key session protected</strong>{keySessionProtected ? `Yes • ${protectedKeyDayLabel}` : 'No'}</span>
                    </div>
                    {completedTodaySummary ? (
                      <div className="training-plan-current-week-panel__completed-today training-plan-current-week-panel__support-card status-item">
                        <strong>Done today</strong>
                        <p>{completedTodaySummary}</p>
                      </div>
                    ) : null}
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
                    <div className="training-plan-execution-changes">
                      <div className="training-plan-execution-changes__header">
                        <div>
                          <div className="kicker">Week reconciliation</div>
                          <strong>Runtime bridge</strong>
                        </div>
                        <div className="chip-row">
                          <span className="chip">{weekPayload.riskFlags[0] || 'No live risk flag yet'}</span>
                          <span className="chip">Block state: {blockPayload.blockState}</span>
                        </div>
                      </div>
                      <p className="training-plan-execution-changes__summary">{slotDiffSummary}</p>
                      <div className="training-plan-execution-changes__events">
                        {currentWeekTruthRows.map((row) => (
                          <div key={`${row.date}-${row.plannedLabel}`} className="training-plan-execution-changes__event-row status-item">
                            <strong>{row.date} • {row.status.replaceAll('_', ' ')}</strong>
                            <p>Planned: {row.plannedLabel}</p>
                            <span>Completed: {row.completedLabel}</span>
                            <span>Runtime bridge: {row.runtimeLabel}</span>
                            <span>{row.driftSummary}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                </div>
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
                notice={notice}
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
                      <p>Draft next month</p>
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
                    {!isCalendarMode ? (
                      <a href={appRoutes.calendar} className="button-secondary button-link">Calendar</a>
                    ) : (
                      <a href={appRoutes.plan} className="button-secondary button-link">Builder</a>
                    )}
                    <span className="chip">Built from: {latestDraft.assumptions?.selectedRecommendationTitle || latestInput?.selectedRecommendation?.title || latestInput?.objective || 'latest planner inputs'} • {fmtHours(latestInput?.mustFollow.maxWeeklyHours || 10.5)} • {latestInput?.preferences.restDay || 'Saturday'} rest</span>
                    <span className="chip">Publish state: {publishStateLabel}</span>
                    <span className="chip">Sync: {publishSyncLabel}</span>
                    <details className="training-plan-inline-panel">
                      <summary title="More month actions">⋯</summary>
                      <div className="training-plan-inline-panel__content">
                        <div className="training-plan-calendar-publish-copy">
                          <strong>Publish future draft</strong>
                          <p>Future weeks only. Live week stays runtime-backed.</p>
                          <p>{publishStateDetail}</p>
                        </div>
                        <a href={appRoutes.dashboard} className="button-secondary button-link">Dashboard</a>
                        <form action="/api/planner/month/publish" method="post">
                          <input type="hidden" name="draftId" value={latestDraft.id} />
                          <button type="submit">Publish plan</button>
                        </form>
                      </div>
                    </details>
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
                <div className="training-plan-category-grid">
                  {comparePayload.categoryComparison.map((item) => (
                    <div key={item.category} className="status-item training-plan-intent-compare-card">
                      <strong>{compareIntentLabel(item.category)}</strong>
                      <p className="training-plan-intent-compare-card__kicker">{item.category}</p>
                      <p>Recent: {item.recentSessions} sessions / {fmtHours(item.recentHours)}</p>
                      <p>Planned: {item.plannedSessions} sessions / {fmtHours(item.plannedHours)}</p>
                      <p>Delta sessions: {item.deltaSessions >= 0 ? '+' : ''}{item.deltaSessions}</p>
                    </div>
                  ))}
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
