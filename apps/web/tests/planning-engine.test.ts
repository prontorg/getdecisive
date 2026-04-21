import test from 'node:test';
import assert from 'node:assert/strict';

import type { DailyDecision, PlanningCycle, PlanningDay } from '../lib/server/planning/types';
import { assemblePlanningInput } from '../lib/server/planning/assemble-planning-input';
import { generateDailyDecision } from '../lib/server/planning/generate-daily-decision';
import { canPlaceHardDay, defaultKeySessionCount, fallbackPlannedTypeForOpenDay, freshnessBandFromForm, resolvePhaseType } from '../lib/server/planning/planning-rules';
import { generateWeeklyCycle } from '../lib/server/planning/generate-weekly-cycle';

test('planning runtime types cover cycle, day, and decision records', () => {
  const cycleStatus: PlanningCycle['status'] = 'active';
  const dayStatus: PlanningDay['status'] = 'planned';
  const confidence: DailyDecision['confidence'] = 'high';
  assert.equal(cycleStatus, 'active');
  assert.equal(dayStatus, 'planned');
  assert.equal(confidence, 'high');
});

const samplePlanningInput = assemblePlanningInput({
  userId: 'user_1',
  stableContext: {
    disciplineFocus: 'track_endurance',
    thresholdAnchorW: 365,
    preferredRestDay: 'Saturday',
    preferredLongRideDay: 'Sunday',
    maxWeeklyHours: 10,
    noBackToBackHardDays: true,
    blankDayDefault: 'support_endurance',
  },
  liveState: {
    today: '2026-04-20',
    goal_race_date: '2026-05-12',
    season_focus: 'repeatability',
    season_phase: 'build',
    wellness: { ctl: 102, atl: 110 },
    recent_rows: [
      { activity_id: 'a1', start_date_local: '2026-04-20T09:00:00', session_type: 'threshold / race-support ride', training_load: 140, duration_s: 7200, summary: { short_label: '3x15 threshold' } },
      { activity_id: 'a2', start_date_local: '2026-04-19T09:00:00', session_type: 'endurance / Z2 ride', training_load: 82, duration_s: 8400, summary: { short_label: 'Support endurance' } },
    ],
  },
  goalEntries: [{ id: 'g1', type: 'race', title: 'A race', targetDate: '2026-05-12', status: 'active', priority: 'A', updatedAt: '2026-04-20T00:00:00Z' }],
  currentDirection: 'Raise repeatability for track racing',
});

test('assemblePlanningInput combines stable context, goals, live state, and execution state', async () => {
  assert.equal(samplePlanningInput.goalContext.keyEventDate, '2026-05-12');
  assert.equal(samplePlanningInput.athleteContext.thresholdAnchorW, 365);
  assert.equal(samplePlanningInput.liveContext.today, '2026-04-20');
  assert.equal(samplePlanningInput.liveContext.currentWeekCompletedRows.length >= 1, true);
});

test('planning rules expose deterministic defaults for phase, key-session count, spacing, and blank days', () => {
  assert.equal(resolvePhaseType(samplePlanningInput), 'build');
  assert.equal(defaultKeySessionCount(samplePlanningInput), 2);
  assert.equal(freshnessBandFromForm(-8), 'manageable_fatigue');
  assert.equal(fallbackPlannedTypeForOpenDay(samplePlanningInput.athleteContext), 'endurance');
  assert.equal(canPlaceHardDay([{ date: '2026-04-22', plannedType: 'threshold_support' }], '2026-04-23', samplePlanningInput.athleteContext), false);
});

test('generateWeeklyCycle creates a balanced build week with key anchors and support days', () => {
  const cycle = generateWeeklyCycle(samplePlanningInput);
  assert.equal(cycle.days.length, 7);
  assert.equal(cycle.days.filter((day) => day.priority === 'key').length, 2);
  assert.equal(cycle.days.some((day) => day.plannedType === 'rest'), true);
  assert.equal(cycle.days.some((day) => day.plannedType === 'endurance'), true);
  assert.equal(cycle.primaryFocus.length > 0, true);
});

test('generateDailyDecision adapts today while protecting weekly balance', () => {
  const cycle = generateWeeklyCycle(samplePlanningInput);
  const decision = generateDailyDecision({ cycle, input: samplePlanningInput });
  assert.equal(decision.plannedForToday.length > 0, true);
  assert.equal(decision.actualRecommendationForToday.length > 0, true);
  assert.equal(decision.plannedForTomorrow.length > 0, true);
  assert.equal(typeof decision.reasonSummary, 'string');
  assert.equal(Array.isArray(decision.risks), true);
});
