import { redirect } from 'next/navigation';

import { appRoutes } from '../../../lib/routes';
import {
  buildCurrentWeekReplanPayload,
  buildGoalPayload,
  buildMonthlyPlannerComparePayload,
  buildMonthlyPlannerContextPayload,
  buildMonthlyPlannerDraftPayload,
  buildPlanningRecommendationPayload,
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
    ? 'Live week first. Future weeks stay editable.'
    : 'Live week first. Future weeks stay editable.';
  const reviewsIntro = isCalendarMode
    ? 'Live week on top, editable month underneath.'
    : 'Live week on top, editable month underneath.';
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
  const draftStatusLabel = latestDraft
    ? latestDraft.publishState === 'published'
      ? 'Draft saved and locally published'
      : 'Draft saved locally and still editable'
    : 'No draft saved yet';
  const recommendationPayload = buildPlanningRecommendationPayload(planner.live, currentDirection);
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
  const selectedRecommendationReason = selectedRecommendation?.reason
    || (selectedRecommendation?.source === 'primary'
      ? recommendationPayload.primary.explanation
      : recommendationPayload.alternatives.find((item) => item.objective === selectedRecommendation?.objective)?.reason)
    || 'No recommendation rationale saved yet.';
  const draftOriginLabel = latestDraft?.assumptions.selectedRecommendationTitle || selectedRecommendation?.title || selectedDirectionLabel;
  const workspaceStatusLabel = latestDraft
    ? 'Reviewing generated draft'
    : latestInput
      ? 'Direction saved, ready to generate draft'
      : 'Waiting for direction selection';
  const changeSummary = activePlanning.summary?.reason || comparePayload.freshnessWarnings[0] || 'No major planning change detected yet.';

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
            <div className="training-plan-quick-builder">
              <div className="training-plan-quick-builder__header">
                <div>
                  <div className="kicker">Quick builder</div>
                  <h3>Choose, tune, review</h3>
                  <p>tap a direction, adjust only what matters, then build.</p>
                </div>
                <div className="chip-row planning-recommendation-chip-row">
                  <span className="chip">Status: {workspaceStatusLabel}</span>
                  <span className="chip">Draft: {draftStatusLabel}</span>
                  <span className="chip">Changed: {changeSummary}</span>
                </div>
              </div>

              <div className="training-plan-live-strip">
                <div className="training-plan-live-strip__item">
                  <strong>Live now</strong>
                  <span>{activePlanning.summary?.plannedToday || 'Planning refresh pending'}</span>
                </div>
                <div className="training-plan-live-strip__item">
                  <strong>Tomorrow</strong>
                  <span>{activePlanning.summary?.likelyTomorrow || activePlanning.summary?.plannedTomorrow || '—'}</span>
                </div>
                <div className="training-plan-live-strip__item">
                  <strong>Freshness</strong>
                  <span>{contextPayload.currentState.freshnessSummary}</span>
                </div>
                <div className="training-plan-live-strip__item">
                  <strong>Key slot</strong>
                  <span>{activePlanning.summary?.nextKeyDay || 'Still resolving'}</span>
                </div>
                <div className="training-plan-live-strip__item">
                  <strong>Updated</strong>
                  <span>{liveSyncStamp}</span>
                </div>
              </div>

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
                  restDay: latestInput?.preferences.restDay || 'Saturday',
                  restDaysPerWeek: latestInput?.preferences.restDaysPerWeek || 1,
                  longRideDay: latestInput?.preferences.longRideDay || 'Sunday',
                  noDoubles: latestInput?.mustFollow.noDoubles ?? true,
                  noBackToBackHardDays: latestInput?.mustFollow.noBackToBackHardDays ?? true,
                  successMarkers: latestInput?.successMarkers || [],
                  note: latestInput?.note || '',
                }}
                successOptions={successOptions}
              />
            </div>
          </AppCard>
        </section>
      ) : (
        <section className="mt-18 training-plan-top-strip__actions">
          <a href={appRoutes.plan} className="button-secondary button-link">Back to plan builder</a>
        </section>
      )}

      <section id="review" className="training-plan-review-stack mt-18">
        <AppCard className="training-plan-card training-plan-card-fullwidth">
          <div className="planning-workspace-section__header planning-workspace-section__header-review">
            <div>
              <span className="training-plan-step-pill">Step 4</span>
              <div className="kicker">Review</div>
              <h2>Review the live week and the generated month</h2>
              {nextFourWeekRange ? <p className="training-plan-range-headline">{nextFourWeekRange}</p> : null}
              {latestDraft ? <p>{reviewsIntro}</p> : null}
            </div>
            {latestDraft ? null : null}
          </div>
          {latestDraft ? (
            <>
              <div className="training-plan-review-guide-grid">
                <div className="training-plan-guide-card">
                  <strong>1. Check the live week</strong>
                  <p>Top-left explains what should happen now and what tomorrow likely becomes.</p>
                </div>
                <div className="training-plan-guide-card">
                  <strong>2. Adjust the draft bridge</strong>
                  <p>Use Repair, Cut load, Use freshness, Reduce, or Race-like only for the remaining editable part of this week.</p>
                </div>
                <div className="training-plan-guide-card">
                  <strong>3. Tidy the month</strong>
                  <p>Then move, lock, soften, or remove future workouts in the calendar before publishing.</p>
                </div>
                <div className="training-plan-guide-card">
                  <strong>Draft built from</strong>
                  <p>{draftOriginLabel}</p>
                </div>
                <div className="training-plan-guide-card">
                  <strong>Why this direction</strong>
                  <p>{latestDraft.assumptions.selectedRecommendationReason || selectedRecommendationReason}</p>
                </div>
                <div className="training-plan-guide-card">
                  <strong>Selection confidence</strong>
                  <p>{latestDraft.assumptions.selectedRecommendationConfidence || selectedRecommendation?.confidence || 'manual'}</p>
                </div>
              </div>
              <div className="training-plan-calendar-toolbar">
                <div className="status-item training-plan-week-decision-panel">
                  <strong>Active week • live runtime</strong>
                  <p>{activePlanning.summary?.weekIntention || 'Planning refresh pending'}</p>
                  <div className="training-plan-mini-facts">
                    <span className="training-plan-mini-fact"><strong>Today</strong>{activePlanning.summary?.plannedToday || '—'}</span>
                    <span className="training-plan-mini-fact"><strong>Done</strong>{activePlanning.summary?.actualToday || '—'}</span>
                    <span className="training-plan-mini-fact"><strong>Tomorrow</strong>{activePlanning.summary?.likelyTomorrow || activePlanning.summary?.plannedTomorrow || '—'}</span>
                    <span className="training-plan-mini-fact"><strong>Confidence</strong>{activePlanning.summary?.confidence || '—'}</span>
                  </div>
                  <p>{activePlanning.summary?.reason || 'Waiting for a current planning decision.'}</p>
                  <p>{activePlanning.summary?.nextKeyDay ? `Next key day ${activePlanning.summary.nextKeyDay}` : 'Next key day still resolving.'}</p>
                  {activePlanning.summary?.risks?.length ? (
                    <p>Risk: {activePlanning.summary.risks[0]}</p>
                  ) : null}
                </div>
                <div className="status-item training-plan-week-decision-panel">
                  <strong>Active-week edits • draft bridge</strong>
                  <p>{currentWeekBridge?.draftBridgeLabel || 'Remaining editable slots in this week are not available yet.'}</p>
                  <div className="training-plan-mini-facts">
                    <span className="training-plan-mini-fact"><strong>Days</strong>{currentWeekBridge?.remainingDays.length ? currentWeekBridge.remainingDays.join(', ') : 'None'}</span>
                    <span className="training-plan-mini-fact"><strong>Missed</strong>{String(currentWeekBridge?.missedSessions.length || 0)}</span>
                    <span className="training-plan-mini-fact"><strong>Hours left</strong>{currentWeekBridge ? `${currentWeekBridge.remainingWeekHours.toFixed(1)} h` : '—'}</span>
                    <span className="training-plan-mini-fact"><strong>Key slots</strong>{String(currentWeekBridge?.remainingQualityBudget ?? '—')}</span>
                  </div>
                  <p>{currentWeekBridge?.recommendationText || 'Waiting for a current-week bridge recommendation.'}</p>
                  <p>{currentWeekBridge?.recommendedNextKeyDay ? `Next key day ${currentWeekBridge.recommendedNextKeyDay}` : 'Next key day still resolving.'}</p>
                  <p>{currentWeekBridge?.selectedDirectionSummary || `Draft built from ${draftOriginLabel}.`}</p>
                  <p className="muted">Only future bridge slots change. Completed work and the live today/tomorrow call stay fixed.</p>
                  <div className="button-row training-plan-action-pills">
                    <form action="/api/planner/month/replan" method="post">
                      <input type="hidden" name="draftId" value={latestDraft.id} />
                      <input type="hidden" name="scenario" value="missed_session" />
                      <button type="submit">Repair</button>
                    </form>
                    <form action="/api/planner/month/replan" method="post">
                      <input type="hidden" name="draftId" value={latestDraft.id} />
                      <input type="hidden" name="scenario" value="fatigued" />
                      <button type="submit">Cut load</button>
                    </form>
                    <form action="/api/planner/month/replan" method="post">
                      <input type="hidden" name="draftId" value={latestDraft.id} />
                      <input type="hidden" name="scenario" value="fresher" />
                      <button type="submit">Use freshness</button>
                    </form>
                    <form action="/api/planner/month/replan" method="post">
                      <input type="hidden" name="draftId" value={latestDraft.id} />
                      <input type="hidden" name="scenario" value="reduce_load" />
                      <button type="submit">Reduce</button>
                    </form>
                    <form action="/api/planner/month/replan" method="post">
                      <input type="hidden" name="draftId" value={latestDraft.id} />
                      <input type="hidden" name="scenario" value="increase_specificity" />
                      <button type="submit">Race-like</button>
                    </form>
                  </div>
                </div>
                <div className="training-plan-calendar-toolbar__actions">
                  {!isCalendarMode ? (
                    <a href={appRoutes.calendar} className="button-secondary button-link">Calendar</a>
                  ) : (
                    <a href={appRoutes.plan} className="button-secondary button-link">Builder</a>
                  )}
                  <a href={appRoutes.dashboard} className="button-secondary button-link">Dashboard</a>
                  <details className="training-plan-inline-panel">
                    <summary title="More month actions">⋯</summary>
                    <div className="training-plan-inline-panel__content">
                      <div className="training-plan-calendar-publish-copy">
                        <strong>Publish future draft</strong>
                        <p>Future weeks only. Live week stays runtime-backed.</p>
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
