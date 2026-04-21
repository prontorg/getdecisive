import test from 'node:test';
import assert from 'node:assert/strict';

import {
  authorizeLiveIntervalsState,
  buildAdaptationPayload,
  buildGoalPayload,
  buildCurrentWeekReplanPayload,
  buildMonthlyPlannerComparePayload,
  buildMonthlyPlannerContextPayload,
  buildMonthlyPlannerDraftPayload,
  buildWeeklyDecisionPayload,
  replanCurrentWeekForScenario,
  replaceCurrentWeekWithRuntime,
  buildPlannerBlockPayload,
  buildPlannerDayPayload,
  buildPlannerWeekPayload,
  buildPowerProfilePayload,
  hydrateUserSnapshotFromSharedLive,
  resolveAuthorizedLiveState,
  getActivePlanningContext,
} from '../lib/server/planner-data';
import { createSeedPlatformState } from '../lib/server/platform-state';
import { appRoutes } from '../lib/routes';

test('planner day payload is explicitly read-only toward Intervals', () => {
  const payload = buildPlannerDayPayload({
    id: 'user_1',
    email: 'athlete@example.com',
    displayName: 'Athlete',
    password: 'secret123',
    workspaceId: 'workspace_1',
  });

  assert.equal(payload.intervalsPlanWriteState, 'disabled_read_only');
  assert.match(payload.planChangeSummary, /read-only/i);
  assert.match(payload.why, /linked to your own login/i);
});

test('planner day payload treats rest day as a real rest day', () => {
  const payload = buildPlannerDayPayload(
    {
      id: 'user_1',
      email: 'athlete@example.com',
      displayName: 'Athlete',
      password: 'secret123',
      workspaceId: 'workspace_1',
    },
    {
      today: '2026-04-13',
      today_plan: 'Rest day',
      tomorrow_plan: '6x4 min @ 410-420 W',
      wellness: { ctl: 107, atl: 120 },
    },
  );

  assert.equal(payload.plannedToday, 'Rest day');
  assert.match(payload.shouldActuallyHappenToday, /real rest day/i);
  assert.match(payload.why, /protect freshness completely today/i);
});

test('live planner data is only exposed to the matching connected athlete', () => {
  const state = createSeedPlatformState();
  state.users.push({
    id: 'user_1',
    email: 'athlete@example.com',
    displayName: 'Athlete',
    password: 'secret123',
    workspaceId: 'workspace_1',
  });
  state.intervalsConnections.push({
    id: 'conn_1',
    userId: 'user_1',
    externalAthleteId: '17634020',
    credentialPayload: 'api_key=xyz',
    syncStatus: 'ready',
    createdAt: '2026-04-13T00:00:00Z',
  });

  const context = {
    state,
    user: state.users[0]!,
    onboardingState: 'ready',
  };

  const allowed = authorizeLiveIntervalsState(context, { today: '2026-04-13', athlete_id: '17634020' });
  const blocked = authorizeLiveIntervalsState(context, { today: '2026-04-13', athlete_id: 'other-athlete' });

  assert.equal(allowed?.athlete_id, '17634020');
  assert.equal(blocked, null);
});

test('resolveAuthorizedLiveState prefers the user snapshot over the shared live source', async () => {
  const state = createSeedPlatformState();
  state.users.push({
    id: 'user_1',
    email: 'athlete@example.com',
    displayName: 'Athlete',
    password: 'secret123',
    workspaceId: 'workspace_1',
  });
  state.intervalsConnections.push({
    id: 'conn_1',
    userId: 'user_1',
    externalAthleteId: '17634020',
    credentialPayload: 'api_key=xyz',
    syncStatus: 'ready',
    createdAt: '2026-04-13T00:00:00Z',
  });
  state.intervalsSnapshots = [{
    id: 'snap_1',
    userId: 'user_1',
    connectionId: 'conn_1',
    sourceJobId: 'job_1',
    capturedAt: '2026-04-13T00:05:00Z',
    liveState: {
      today: '2026-04-13',
      athlete_id: '17634020',
      today_plan: 'Z2 endurance',
      tomorrow_plan: '6x4 min @ 410-420 W',
      wellness: { ctl: 107, atl: 128 },
    },
  }];

  const context = {
    state,
    user: state.users[0]!,
    onboardingState: 'ready',
  };

  const resolved = await resolveAuthorizedLiveState(context, { today: '2026-04-13', athlete_id: 'other-athlete' });

  assert.equal(resolved?.athlete_id, '17634020');
  assert.equal(resolved?.tomorrow_plan, '6x4 min @ 410-420 W');
});

test('hydrateUserSnapshotFromSharedLive completes the latest sync job when the shared live athlete matches', async () => {
  const state = createSeedPlatformState();
  state.users.push({
    id: 'user_1',
    email: 'athlete@example.com',
    displayName: 'Athlete',
    password: 'secret123',
    workspaceId: 'workspace_1',
  });
  state.onboardingRuns.push({
    id: 'onboard_1',
    userId: 'user_1',
    state: 'sync_started',
    progressPct: 25,
    statusMessage: 'Sync job queued',
    syncStartedAt: '2026-04-13T00:00:00Z',
    updatedAt: '2026-04-13T00:00:00Z',
  });
  state.intervalsConnections.push({
    id: 'conn_1',
    userId: 'user_1',
    externalAthleteId: '17634020',
    credentialPayload: 'api_key=xyz',
    syncStatus: 'sync_started',
    createdAt: '2026-04-13T00:00:00Z',
  });
  state.syncJobs.push({
    id: 'job_1',
    userId: 'user_1',
    connectionId: 'conn_1',
    jobType: 'intervals_initial_sync',
    status: 'running',
    progressPct: 88,
    statusMessage: 'Waiting',
    startedAt: '2026-04-13T00:00:00Z',
    updatedAt: '2026-04-13T00:00:00Z',
  });

  const hydrated = await hydrateUserSnapshotFromSharedLive(state, 'user_1', {
    today: '2026-04-13',
    athlete_id: '17634020',
    today_plan: 'Z2 endurance',
    tomorrow_plan: '6x4 min @ 410-420 W',
  });
  assert.equal(hydrated, true);
  assert.equal(state.syncJobs[0]?.status, 'completed');
  assert.equal(state.onboardingRuns[0]?.state, 'ready');
  assert.equal(state.intervalsSnapshots[0]?.liveState.athlete_id, '17634020');
});

test('power profile payload points deep analysis to the planner workspace', () => {
  const payload = buildPowerProfilePayload();

  assert.equal(payload.analysisViewRoute, appRoutes.plan);
  assert.equal(payload.recommendedEmphasisChanges.some((item) => /Plan/.test(item)), true);
});

test('goal and adaptation payloads explain safe read-only behavior', () => {
  const goals = buildGoalPayload();
  const adaptation = buildAdaptationPayload();

  assert.equal(goals.activeGoals.length > 0, true);
  assert.equal(adaptation.manualReviewRecommended, true);
  assert.match(adaptation.userFacingExplanation, /read-only toward Intervals/i);
});

test('monthly planner context payload exposes trust-building assumptions and compact status-quo facts', () => {
  const payload = buildMonthlyPlannerContextPayload({
    today: '2026-04-13',
    goal_race_date: '2026-05-12',
    season_phase: 'specific-prep',
    wellness: { ctl: 104, atl: 109 },
    recent_rows: [
      { activity_id: '1', start_date_local: '2026-04-12T09:00:00', session_type: 'broken VO2 / repeatability session', training_load: 130, duration_s: 5400, summary: { short_label: '30/15 set' } },
      { activity_id: '2', start_date_local: '2026-04-11T09:00:00', session_type: 'threshold / race-support ride', training_load: 145, duration_s: 7200, summary: { short_label: '2x15 threshold' } },
    ],
  }, 'Raise repeatability for track racing');

  assert.equal(payload.goalEvent.date, '2026-05-12');
  assert.equal(payload.goalEvent.currentDirection, 'Raise repeatability for track racing');
  assert.match(payload.currentState.freshnessSummary, /Freshness is/i);
  assert.equal(payload.recentHistory.keySessions.length > 0, true);
  assert.equal(payload.guardrails.summary.some((item) => /back-to-back hard days/i.test(item)), true);
  assert.match(payload.statusQuo.mainImplication, /month|build|specificity|freshness|repeatability/i);
  assert.match(payload.statusQuo.eventProximity, /event|days/i);
  assert.equal(payload.statusQuo.recentFocus.length >= 2, true);
});

test('monthly planner draft payload keeps week 4 lighter, respects max weekly hours, and starts from the current week while accounting for current-week completed work', () => {
  const payload = buildMonthlyPlannerDraftPayload({
    today: '2026-04-16',
    goal_race_date: '2026-05-12',
    wellness: { ctl: 104, atl: 109 },
    recent_rows: [
      { activity_id: '1', start_date_local: '2026-04-15T09:00:00', session_type: 'broken VO2 / repeatability session', training_load: 130, duration_s: 5400, summary: { short_label: '30/15 set' }, weighted_avg_watts: 402, zone_times: { Z5: 900, Z6: 420 } },
      { activity_id: '2', start_date_local: '2026-04-14T09:00:00', session_type: 'threshold / race-support ride', training_load: 145, duration_s: 7200, summary: { short_label: '2x15 threshold' }, weighted_avg_watts: 356, zone_times: { Z4: 2400, SS: 900 } },
      { activity_id: '3', start_date_local: '2026-04-13T09:00:00', session_type: 'endurance / Z2 ride', training_load: 95, duration_s: 10800, summary: { short_label: 'Endurance' }, zone_times: { Z2: 9000 } },
    ],
  }, {
    objective: 'repeatability',
    ambition: 'balanced',
    currentDirection: 'Raise repeatability for track racing',
    mustFollow: { noBackToBackHardDays: true, maxWeeklyHours: 10 },
  });

  assert.equal(payload.weeks.length, 4);
  assert.equal(payload.weeks[3]?.targetHours! < payload.weeks[1]?.targetHours!, true);
  assert.equal(payload.weeks[0]?.workouts.some((workout) => workout.category === 'threshold_support' || workout.category === 'repeatability'), true);
  assert.equal(payload.weeks[0]?.workouts.some((workout) => workout.category === 'rest'), true);
  assert.match(payload.weeks[2]?.rationale.mainAim || '', /goals, current figures, and recent history|current figures, and recent history/i);
  assert.equal(payload.weeks.every((week) => week.targetHours <= 10), true);
  assert.equal(payload.weeks[0]?.workouts.some((workout) => workout.date < '2026-04-16'), false);
  assert.equal(payload.weeks[0]?.completedThisWeek?.length, 3);
  assert.equal(payload.weeks[0]?.workouts.some((workout) => workout.category === 'rest'), true);
  assert.equal(payload.weeks[0]?.workouts.some((workout) => workout.category === 'endurance'), true);
  assert.equal(payload.weeks[0]?.weekTypeLabel, 'Repeatability week');
  assert.equal(typeof payload.weeks[0]?.availableHours, 'number');
  assert.equal(payload.weeks[0]?.eventHours, 0);
});

test('monthly planner draft payload subtracts planning-event hours from the affected week budget', () => {
  const payload = buildMonthlyPlannerDraftPayload({
    today: '2026-04-16',
    goal_race_date: '2026-05-12',
    wellness: { ctl: 104, atl: 109 },
    recent_rows: [
      { activity_id: '1', start_date_local: '2026-04-15T09:00:00', session_type: 'broken VO2 / repeatability session', training_load: 130, duration_s: 5400, summary: { short_label: '30/15 set' } },
      { activity_id: '2', start_date_local: '2026-04-14T09:00:00', session_type: 'threshold / race-support ride', training_load: 145, duration_s: 7200, summary: { short_label: '2x15 threshold' } },
      { activity_id: '3', start_date_local: '2026-04-13T09:00:00', session_type: 'endurance / Z2 ride', training_load: 95, duration_s: 10800, summary: { short_label: 'Endurance' } },
    ],
  }, {
    objective: 'repeatability',
    ambition: 'balanced',
    currentDirection: 'Raise repeatability for track racing',
    mustFollow: { noBackToBackHardDays: true, maxWeeklyHours: 10 },
    planEvents: [
      { id: 'event_1', title: 'Track omnium', date: '2026-04-22', type: 'A_race', priority: 'primary', durationHours: 4 },
    ],
  });

  assert.equal(payload.weeks[1]?.targetHours, 6);
  assert.equal(payload.weeks[1]?.availableHours, 6);
  assert.equal(payload.weeks[1]?.eventHours, 4);
  assert.equal(payload.weeks[1]?.weekTypeLabel, 'Repeatability week');
  assert.match(payload.weeks[1]?.rationale.protected || '', /event|race|travel/i);
});

test('monthly planner duration distribution keeps endurance longest without bloating quality sessions as weekly hours rise', () => {
  const payload = buildMonthlyPlannerDraftPayload({
    today: '2026-04-16',
    goal_race_date: '2026-05-12',
    wellness: { ctl: 104, atl: 109 },
    recent_rows: [
      { activity_id: '1', start_date_local: '2026-04-15T09:00:00', session_type: 'broken VO2 / repeatability session', training_load: 130, duration_s: 7200, summary: { short_label: '30/15 set' } },
      { activity_id: '2', start_date_local: '2026-04-14T09:00:00', session_type: 'threshold / race-support ride', training_load: 145, duration_s: 9000, summary: { short_label: '2x15 threshold' } },
      { activity_id: '3', start_date_local: '2026-04-13T09:00:00', session_type: 'endurance / Z2 ride', training_load: 95, duration_s: 14400, summary: { short_label: 'Endurance' } },
      { activity_id: '4', start_date_local: '2026-04-12T09:00:00', session_type: 'endurance / Z2 ride', training_load: 88, duration_s: 12600, summary: { short_label: 'Long endurance' } },
      { activity_id: '5', start_date_local: '2026-04-11T09:00:00', session_type: 'threshold / race-support ride', training_load: 120, duration_s: 7200, summary: { short_label: 'Tempo support' } },
    ],
  }, {
    objective: 'repeatability',
    ambition: 'ambitious',
    currentDirection: 'Raise repeatability for track racing',
    mustFollow: { noBackToBackHardDays: true, maxWeeklyHours: 14 },
  });

  const targetWeek = payload.weeks[1]!;
  const enduranceDurations = targetWeek.workouts.filter((workout) => workout.category === 'endurance').map((workout) => Number(workout.durationMinutes || 0));
  const qualityDurations = targetWeek.workouts.filter((workout) => workout.category === 'repeatability' || workout.category === 'threshold_support' || workout.category === 'race_like').map((workout) => Number(workout.durationMinutes || 0));
  const supportEndurance = targetWeek.workouts.find((workout) => workout.label === 'Support endurance');
  const longEndurance = targetWeek.workouts.find((workout) => workout.label === 'Long endurance support');

  assert.equal(targetWeek.targetHours >= 7, true);
  assert.equal(Math.max(...enduranceDurations) > Math.max(...qualityDurations), true);
  assert.equal(Math.max(...qualityDurations) <= 95, true);
  assert.equal(Number(supportEndurance?.durationMinutes || 0) <= 105, true);
  assert.equal(Number(longEndurance?.durationMinutes || 0) >= Number(supportEndurance?.durationMinutes || 0) + 70, true);
});

test('monthly planner duration distribution stays phase-specific for race-like and lighter weeks', () => {
  const payload = buildMonthlyPlannerDraftPayload({
    today: '2026-04-16',
    goal_race_date: '2026-05-12',
    wellness: { ctl: 104, atl: 109 },
    recent_rows: [
      { activity_id: '1', start_date_local: '2026-04-15T09:00:00', session_type: 'broken VO2 / repeatability session', training_load: 130, duration_s: 7200, summary: { short_label: '30/15 set' } },
      { activity_id: '2', start_date_local: '2026-04-14T09:00:00', session_type: 'threshold / race-support ride', training_load: 145, duration_s: 9000, summary: { short_label: '2x15 threshold' } },
      { activity_id: '3', start_date_local: '2026-04-13T09:00:00', session_type: 'endurance / Z2 ride', training_load: 95, duration_s: 14400, summary: { short_label: 'Endurance' } },
      { activity_id: '4', start_date_local: '2026-04-12T09:00:00', session_type: 'race simulation / points race', training_load: 122, duration_s: 6300, summary: { short_label: 'Race sim' } },
    ],
  }, {
    objective: 'race_specificity',
    ambition: 'ambitious',
    currentDirection: 'Increase race-like specificity for track racing',
    mustFollow: { noBackToBackHardDays: true, maxWeeklyHours: 12 },
  });

  const raceWeek = payload.weeks[1]!;
  const lighterWeek = payload.weeks[3]!;
  const raceLikeWorkout = raceWeek.workouts.find((workout) => workout.category === 'race_like');
  const lighterLongEndurance = lighterWeek.workouts.find((workout) => workout.label === 'Endurance support');

  assert.equal(Number(raceLikeWorkout?.durationMinutes || 0) <= 90, true);
  assert.equal(raceWeek.workouts.filter((workout) => workout.category === 'endurance').every((workout) => Number(workout.durationMinutes || 0) <= 150), true);
  assert.equal(Number(lighterLongEndurance?.durationMinutes || 0) <= 120, true);
});

test('monthly planner draft payload applies selected rest day, configurable rest-day count, and disabled back-to-back guardrail without dropping sessions', () => {
  const payload = buildMonthlyPlannerDraftPayload({
    today: '2026-04-16',
    goal_race_date: '2026-05-12',
    wellness: { ctl: 104, atl: 109 },
    recent_rows: [
      { activity_id: '1', start_date_local: '2026-04-15T09:00:00', session_type: 'broken VO2 / repeatability session', training_load: 130, duration_s: 5400, summary: { short_label: '30/15 set' } },
      { activity_id: '2', start_date_local: '2026-04-14T09:00:00', session_type: 'threshold / race-support ride', training_load: 145, duration_s: 7200, summary: { short_label: '2x15 threshold' } },
    ],
  }, {
    objective: 'race_specificity',
    ambition: 'balanced',
    currentDirection: 'Increase race-like specificity for track racing',
    successMarkers: ['Arrive at key sessions fresher'],
    mustFollow: { noBackToBackHardDays: false, maxWeeklyHours: 10 },
    preferences: { restDay: 'Monday', restDaysPerWeek: 2, longRideDay: 'Thursday' },
  });

  const firstWeek = payload.weeks[0]!;
  const configuredWeek = payload.weeks[1]!;
  const restWorkouts = configuredWeek.workouts.filter((workout) => workout.category === 'rest');
  const thursdayWorkout = configuredWeek.workouts.find((workout) => workout.category === 'endurance' && workout.date.endsWith('-23'));
  const fridayWorkout = configuredWeek.workouts.find((workout) => workout.date.endsWith('-24'));

  assert.equal(configuredWeek.workouts.length >= 5, true);
  assert.equal(restWorkouts.length, 2);
  assert.equal(restWorkouts.every((workout) => workout.label === 'Rest'), true);
  assert.equal(thursdayWorkout?.label, 'Long endurance support');
  assert.equal(fridayWorkout?.category, 'race_like');
  assert.equal(configuredWeek.longSessionDay, 'Thursday');
  assert.equal(firstWeek.completedThisWeek?.length, 2);
  assert.match(configuredWeek.intent, /^Race-like focus\.|^Threshold focus\.|^Repeatability focus\.|^Lighter week\./i);
});

test('monthly planner draft payload uses current direction, freshness, and recent signals to bias recommendations', () => {
  const payload = buildMonthlyPlannerDraftPayload({
    today: '2026-04-20',
    goal_race_date: '2026-05-12',
    working_threshold_w: 365,
    wellness: { ctl: 106, atl: 123 },
    recent_rows: [
      { activity_id: '1', start_date_local: '2026-04-19T09:00:00', session_type: 'threshold / race-support ride', training_load: 142, duration_s: 7200, weighted_avg_watts: 362, summary: { short_label: '3x15 threshold' }, zone_times: { Z4: 2600 } },
      { activity_id: '2', start_date_local: '2026-04-17T09:00:00', session_type: 'threshold / race-support ride', training_load: 138, duration_s: 6900, weighted_avg_watts: 358, summary: { short_label: '2x15 threshold' }, zone_times: { Z4: 2300 } },
      { activity_id: '3', start_date_local: '2026-04-16T09:00:00', session_type: 'endurance / Z2 ride', training_load: 88, duration_s: 9600, summary: { short_label: 'Long endurance' }, zone_times: { Z2: 8200 } },
    ],
  }, {
    objective: 'repeatability',
    ambition: 'balanced',
    currentDirection: 'Keep threshold support repeatable without excess fatigue',
    mustFollow: { noBackToBackHardDays: true, maxWeeklyHours: 10.5 },
  });

  const firstWeek = payload.weeks[0]!;
  assert.equal(firstWeek.workouts[1]?.category, 'threshold_support');
  assert.equal(firstWeek.workouts.some((workout) => workout.category === 'race_like'), false);
  assert.match(firstWeek.intent, /^Threshold focus\./i);
  assert.match(firstWeek.rationale.mainAim, /goals, current figures, and recent history|current figures, and recent history/i);
});

test('monthly planner draft payload starts from the current week and respects the remaining weekly-hour cap', () => {
  const payload = buildMonthlyPlannerDraftPayload({
    today: '2026-04-23',
    goal_race_date: '2026-05-12',
    working_threshold_w: 365,
    wellness: { ctl: 105, atl: 112 },
    recent_rows: [
      { activity_id: '1', start_date_local: '2026-04-21T09:00:00', session_type: 'threshold / race-support ride', training_load: 142, duration_s: 7200, weighted_avg_watts: 360, summary: { short_label: '3x15 threshold' }, zone_times: { Z4: 2500 } },
      { activity_id: '2', start_date_local: '2026-04-22T09:00:00', session_type: 'endurance / Z2 ride', training_load: 78, duration_s: 5400, summary: { short_label: 'Support endurance' }, zone_times: { Z2: 4800 } },
      { activity_id: '3', start_date_local: '2026-04-20T09:00:00', session_type: 'endurance / Z2 ride', training_load: 95, duration_s: 9000, summary: { short_label: 'Long endurance' }, zone_times: { Z2: 7800 } },
    ],
  }, {
    objective: 'race_specificity',
    ambition: 'balanced',
    currentDirection: 'Sharpen race-like work from current figures and recent history',
    mustFollow: { noBackToBackHardDays: true, maxWeeklyHours: 8 },
  });

  const firstWeek = payload.weeks[0]!;
  const firstPlannedDate = firstWeek.workouts[0]?.date;
  const firstWeekPlannedHours = firstWeek.workouts.reduce((acc, workout) => acc + Number(workout.durationMinutes || 0), 0) / 60;
  const firstWeekCompletedHours = (firstWeek.completedThisWeek || []).reduce((acc, workout) => acc + Number(workout.durationMinutes || 0), 0) / 60;

  assert.equal(firstPlannedDate >= '2026-04-23', true);
  assert.equal(firstPlannedDate <= '2026-04-24', true);
  assert.equal(firstWeekCompletedHours > 0, true);
  assert.equal(Number((firstWeekPlannedHours + firstWeekCompletedHours).toFixed(1)) <= 8, true);
  assert.match(firstWeek.intent, /focus\./i);
});

test('monthly planner decision engine exposes focus, confidence, risks, and remaining budget for the current week', () => {
  const draft = buildMonthlyPlannerDraftPayload({
    today: '2026-04-17',
    goal_race_date: '2026-05-12',
    working_threshold_w: 365,
    wellness: { ctl: 106, atl: 118 },
    recent_rows: [
      { activity_id: '1', start_date_local: '2026-04-16T09:00:00', session_type: 'threshold / race-support ride', training_load: 142, duration_s: 7200, weighted_avg_watts: 360, summary: { short_label: '3x15 threshold' }, zone_times: { Z4: 2500 } },
      { activity_id: '2', start_date_local: '2026-04-15T09:00:00', session_type: 'broken VO2 / repeatability session', training_load: 126, duration_s: 5400, summary: { short_label: '30/15 set' }, zone_times: { Z5: 920 } },
      { activity_id: '3', start_date_local: '2026-04-14T09:00:00', session_type: 'endurance / Z2 ride', training_load: 84, duration_s: 9000, summary: { short_label: 'Endurance' }, zone_times: { Z2: 7600 } },
    ],
  }, {
    objective: 'race_specificity',
    ambition: 'balanced',
    currentDirection: 'Sharpen toward track racing',
    mustFollow: { noBackToBackHardDays: true, maxWeeklyHours: 9.5 },
    preferences: { restDay: 'Saturday', restDaysPerWeek: 1, longRideDay: 'Sunday' },
  });

  const decision = buildWeeklyDecisionPayload({
    today: '2026-04-17',
    goal_race_date: '2026-05-12',
    wellness: { ctl: 106, atl: 118 },
    recent_rows: [
      { activity_id: '1', start_date_local: '2026-04-16T09:00:00', session_type: 'threshold / race-support ride', training_load: 142, duration_s: 7200, summary: { short_label: '3x15 threshold' } },
      { activity_id: '2', start_date_local: '2026-04-15T09:00:00', session_type: 'broken VO2 / repeatability session', training_load: 126, duration_s: 5400, summary: { short_label: '30/15 set' } },
    ],
  }, draft, {
    objective: 'race_specificity',
    ambition: 'balanced',
    currentDirection: 'Sharpen toward track racing',
    mustFollow: { noBackToBackHardDays: true, maxWeeklyHours: 9.5 },
    preferences: { restDay: 'Saturday', restDaysPerWeek: 1, longRideDay: 'Sunday' },
  });

  assert.match(decision.focus, /race_specificity|threshold_support|repeatability|aerobic_support|unload/);
  assert.match(decision.confidence, /low|medium|high/);
  assert.equal(Array.isArray(decision.reasons), true);
  assert.equal(Array.isArray(decision.riskFlags), true);
  assert.equal(typeof decision.remainingWeekHours, 'number');
  assert.equal(typeof decision.remainingQualityBudget, 'number');
});

test('current-week replanning payload compares planned versus done and recommends what should happen next', () => {
  const live = {
    today: '2026-04-17',
    goal_race_date: '2026-05-12',
    wellness: { ctl: 106, atl: 118 },
    recent_rows: [
      { activity_id: '1', start_date_local: '2026-04-14T09:00:00', session_type: 'endurance / Z2 ride', training_load: 82, duration_s: 8400, summary: { short_label: 'Endurance' } },
      { activity_id: '2', start_date_local: '2026-04-15T09:00:00', session_type: 'threshold / race-support ride', training_load: 145, duration_s: 7200, summary: { short_label: 'Threshold' } },
      { activity_id: '3', start_date_local: '2026-04-16T09:00:00', session_type: 'endurance / Z2 ride', training_load: 54, duration_s: 3600, summary: { short_label: 'Recovery spin' } },
    ],
  };
  const draft = buildMonthlyPlannerDraftPayload(live, {
    objective: 'race_specificity',
    ambition: 'balanced',
    currentDirection: 'Sharpen toward track racing',
    mustFollow: { noBackToBackHardDays: true, maxWeeklyHours: 9.5 },
    preferences: { restDay: 'Saturday', restDaysPerWeek: 1, longRideDay: 'Sunday' },
  });

  const payload = buildCurrentWeekReplanPayload(live, draft, {
    objective: 'race_specificity',
    ambition: 'balanced',
    currentDirection: 'Sharpen toward track racing',
    mustFollow: { noBackToBackHardDays: true, maxWeeklyHours: 9.5 },
    preferences: { restDay: 'Saturday', restDaysPerWeek: 1, longRideDay: 'Sunday' },
  });

  assert.match(payload.liveWindowLabel, /live active week/i);
  assert.match(payload.draftBridgeLabel, /draft bridge/i);
  assert.equal(Array.isArray(payload.plannedSoFar), true);
  assert.equal(Array.isArray(payload.completedSoFar), true);
  assert.equal(Array.isArray(payload.missedSessions), true);
  assert.equal(Array.isArray(payload.remainingDays), true);
  assert.equal(typeof payload.recommendedNextKeyDay, 'string');
  assert.match(payload.recommendedFocus, /race_specificity|threshold_support|repeatability|aerobic_support|unload/);
  assert.equal(typeof payload.recommendationText, 'string');
});

test('runtime current-week override keeps completed and still-planned same-day sessions visible and handles moved or sparse draft dates', () => {
  const weeks = [{
    id: 'week_1',
    weekIndex: 1,
    label: 'Week 1',
    intent: 'Draft intent',
    targetHours: 8,
    targetLoad: 400,
    rationale: { carriedForward: 'A', protected: 'B', mainAim: 'C' },
    completedThisWeek: [],
    workouts: [
      { id: 'moved_1', date: '2026-04-15', label: 'Moved threshold', category: 'threshold_support', durationMinutes: 75, targetLoad: 80, locked: false },
      { id: 'moved_2', date: '2026-04-19', label: 'Moved endurance', category: 'endurance', durationMinutes: 120, targetLoad: 70, locked: false },
    ],
  }] as any;
  const cycle = {
    id: 'cycle_1',
    validFrom: '2026-04-13',
    validTo: '2026-04-19',
    primaryFocus: 'repeatability',
    phaseType: 'build',
    days: [
      { id: 'd1', date: '2026-04-17', plannedLabel: 'Threshold support', plannedStructure: '3x10', plannedDurationMin: 90, plannedLoadMin: 95 },
      { id: 'd2', date: '2026-04-18', plannedLabel: 'Support endurance', plannedStructure: 'Endurance', plannedDurationMin: 120, plannedLoadMin: 70 },
    ],
  } as any;
  const live = {
    today: '2026-04-17',
    recent_rows: [
      { activity_id: 'done_1', start_date_local: '2026-04-14T08:00:00', session_type: 'endurance / Z2 ride', training_load: 40, duration_s: 3600, summary: { short_label: 'AM spin' } },
      { activity_id: 'done_2', start_date_local: '2026-04-17T06:00:00', session_type: 'endurance / Z2 ride', training_load: 35, duration_s: 2700, summary: { short_label: 'Openers' } },
    ],
  } as any;

  const replaced = replaceCurrentWeekWithRuntime({ weeks, today: '2026-04-17', cycle, live });
  const week = replaced[0]!;

  assert.equal(week.completedThisWeek?.length, 2);
  assert.equal(week.workouts.some((workout: any) => workout.date === '2026-04-17'), true);
  assert.equal(week.workouts.some((workout: any) => workout.date === '2026-04-18'), true);
  assert.equal(week.targetHours > 0, true);
  assert.equal(week.targetLoad > 0, true);
});

test('current-week scenario replanning preserves completed work and changes remaining unlocked work only', () => {
  const live = {
    today: '2026-04-17',
    goal_race_date: '2026-05-12',
    wellness: { ctl: 106, atl: 121 },
    recent_rows: [
      { activity_id: '1', start_date_local: '2026-04-14T09:00:00', session_type: 'endurance / Z2 ride', training_load: 82, duration_s: 8400, summary: { short_label: 'Endurance' } },
      { activity_id: '2', start_date_local: '2026-04-15T09:00:00', session_type: 'threshold / race-support ride', training_load: 145, duration_s: 7200, summary: { short_label: 'Threshold' } },
    ],
  };
  const draft = buildMonthlyPlannerDraftPayload(live, {
    objective: 'race_specificity',
    ambition: 'balanced',
    currentDirection: 'Sharpen toward track racing',
    mustFollow: { noBackToBackHardDays: true, maxWeeklyHours: 9 },
    preferences: { restDay: 'Saturday', restDaysPerWeek: 1, longRideDay: 'Sunday' },
  });

  const replanned = replanCurrentWeekForScenario(live, draft, {
    objective: 'race_specificity',
    ambition: 'balanced',
    currentDirection: 'Sharpen toward track racing',
    mustFollow: { noBackToBackHardDays: true, maxWeeklyHours: 9 },
    preferences: { restDay: 'Saturday', restDaysPerWeek: 1, longRideDay: 'Sunday' },
  }, 'fatigued');

  assert.equal(replanned.weekIndex, 1);
  assert.deepEqual(replanned.completedThisWeek, draft.weeks[0]?.completedThisWeek);
  assert.equal(replanned.workouts.every((workout) => workout.date >= '2026-04-17'), true);
  assert.equal(replanned.targetHours <= (draft.weeks[0]?.targetHours || 99), true);
});

test('runtime current-week override respects monday rollover when today is monday', () => {
  const weeks = [{
    id: 'week_rollover',
    weekIndex: 2,
    label: 'Week 2',
    intent: 'Draft intent',
    targetHours: 7,
    targetLoad: 320,
    rationale: { carriedForward: 'A', protected: 'B', mainAim: 'C' },
    completedThisWeek: [],
    workouts: [
      { id: 'sparse_1', date: '2026-04-20', label: 'Monday intensity', category: 'repeatability', durationMinutes: 75, targetLoad: 90, locked: false },
      { id: 'sparse_2', date: '2026-04-24', label: 'Friday endurance', category: 'endurance', durationMinutes: 120, targetLoad: 65, locked: false },
    ],
  }] as any;
  const cycle = {
    id: 'cycle_rollover',
    validFrom: '2026-04-20',
    validTo: '2026-04-26',
    primaryFocus: 'threshold_support',
    phaseType: 'build',
    days: [
      { id: 'day_1', date: '2026-04-20', plannedLabel: 'Threshold support', plannedStructure: '3x12', plannedDurationMin: 85, plannedLoadMin: 92 },
      { id: 'day_2', date: '2026-04-21', plannedLabel: 'Support endurance', plannedStructure: 'Z2', plannedDurationMin: 90, plannedLoadMin: 55 },
    ],
  } as any;

  const replaced = replaceCurrentWeekWithRuntime({ weeks, today: '2026-04-20', cycle, live: { today: '2026-04-20', recent_rows: [] } as any });
  const week = replaced[0]!;

  assert.equal(week.workouts.some((workout: any) => workout.date === '2026-04-20'), true);
  assert.equal(week.workouts.some((workout: any) => workout.date === '2026-04-21'), true);
  assert.match(week.intent || '', /threshold_support/i);
});

test('monthly planner compare payload contrasts draft against the recent 4 weeks and surfaces freshness-risk warnings', () => {
  const live = {
    today: '2026-04-13',
    recent_rows: [
      { activity_id: '1', start_date_local: '2026-04-12T09:00:00', session_type: 'broken VO2 / repeatability session', training_load: 130, duration_s: 5400, summary: { short_label: '30/15 set' } },
      { activity_id: '2', start_date_local: '2026-04-11T09:00:00', session_type: 'threshold / race-support ride', training_load: 145, duration_s: 7200, summary: { short_label: '2x15 threshold' } },
      { activity_id: '3', start_date_local: '2026-04-10T09:00:00', session_type: 'endurance / Z2 ride', training_load: 210, duration_s: 14400, summary: { short_label: 'Long endurance' } },
      { activity_id: '4', start_date_local: '2026-04-08T09:00:00', session_type: 'race or race-like stochastic session', training_load: 118, duration_s: 4800, summary: { short_label: 'Race-like' } },
    ],
  };

  const compare = buildMonthlyPlannerComparePayload(live, {
    monthStart: '2026-04-01',
    objective: 'repeatability',
    ambition: 'balanced',
    assumptions: {
      ctl: 104,
      atl: 109,
      form: -5,
      recentSummary: [],
      availabilitySummary: [],
      guardrailSummary: [],
    },
    weeks: [
      {
        weekIndex: 1,
        label: 'Stabilize',
        intent: 'A',
        targetHours: 14,
        targetLoad: 730,
        rationale: { carriedForward: 'A', protected: 'B', mainAim: 'C' },
        workouts: [
          { date: '2026-04-14', label: 'Repeatability anchor', category: 'repeatability', durationMinutes: 85, targetLoad: 95, locked: false },
          { date: '2026-04-15', label: 'Threshold support', category: 'threshold_support', durationMinutes: 90, targetLoad: 92, locked: false },
          { date: '2026-04-16', label: 'Race-like session', category: 'race_like', durationMinutes: 90, targetLoad: 96, locked: false },
          { date: '2026-04-20', label: 'Long endurance support', category: 'endurance', durationMinutes: 240, targetLoad: 140, locked: false },
        ],
      },
      {
        weekIndex: 2,
        label: 'Build',
        intent: 'A',
        targetHours: 10,
        targetLoad: 500,
        rationale: { carriedForward: 'A', protected: 'B', mainAim: 'C' },
        workouts: [
          { date: '2026-04-21', label: 'Repeatability anchor', category: 'repeatability', durationMinutes: 85, targetLoad: 98, locked: false },
          { date: '2026-04-24', label: 'Race-like session', category: 'race_like', durationMinutes: 90, targetLoad: 96, locked: false },
        ],
      },
      { weekIndex: 3, label: 'Build', intent: 'A', targetHours: 10, targetLoad: 510, rationale: { carriedForward: 'A', protected: 'B', mainAim: 'C' }, workouts: [] },
      { weekIndex: 4, label: 'Absorb', intent: 'A', targetHours: 7.5, targetLoad: 320, rationale: { carriedForward: 'A', protected: 'B', mainAim: 'C' }, workouts: [] },
    ],
  });

  assert.equal(compare.recentWindow.label, 'Recent 4 weeks');
  assert.equal(compare.draftWindow.label, 'Planned next 4 weeks');
  assert.equal(compare.categoryComparison.some((item) => item.category === 'repeatability' && item.recentSessions >= 1), true);
  assert.equal(compare.categoryComparison.some((item) => item.category === 'threshold_support' && item.recentSessions >= 1), true);
  assert.equal(compare.categoryComparison.some((item) => item.deltaSessions > 0), true);
  assert.match(compare.summary, /planned next 4 weeks/i);
  assert.equal(compare.freshnessWarnings.length >= 2, true);
  assert.equal(compare.freshnessWarnings.some((item) => /back-to-back hard days/i.test(item)), true);
  assert.equal(compare.freshnessWarnings.some((item) => /load jump/i.test(item)), true);
});

test('week and block payloads reflect live track-endurance structure instead of scaffold text', () => {
  const live = {
    today: '2026-04-13',
    today_plan: 'Z2 endurance',
    tomorrow_plan: '6x4 min @ 410-420 W',
    season_phase: 'specific-prep',
    wellness: { ctl: 107, atl: 128 },
    next_three: [
      { day: 'Wed', date: '2026-04-15', plan: 'Endurance / support' },
      { day: 'Thu', date: '2026-04-16', plan: 'Threshold support' },
    ],
    recent_rows: [
      { activity_id: '1', start_date_local: '2026-04-12T09:00:00', session_type: 'broken VO2 / repeatability session', training_load: 130, duration_s: 5400, summary: { short_label: '30/15 set' } },
      { activity_id: '2', start_date_local: '2026-04-11T09:00:00', session_type: 'threshold / race-support ride', training_load: 145, duration_s: 7200, summary: { short_label: '2x15 threshold' } },
      { activity_id: '3', start_date_local: '2026-04-10T09:00:00', session_type: 'endurance / Z2 ride', training_load: 210, duration_s: 14400, summary: { short_label: 'Long endurance' } },
    ],
  };

  const week = buildPlannerWeekPayload(live);
  const block = buildPlannerBlockPayload(live);

  assert.match(week.weekIntent, /track-endurance quality/i);
  assert.equal(week.keySessionsCompleted.length > 0, true);
  assert.match(week.fatigueTrend, /CTL 107, ATL 128, Form -21/i);
  assert.equal(week.riskFlags.some((item) => /read-only/i.test(item)), true);

  assert.equal(block.activeBlock, 'specific-prep');
  assert.match(block.sessionsCompletedAgainstIntendedPattern, /1 repeatability/i);
  assert.equal(block.intervalsPlanWriteState, 'disabled_read_only');
});

test('getActivePlanningContext returns active cycle, latest decision, and summary when present', async () => {
  const { savePlanningContext } = await import('../lib/server/planner-customization');
  const { savePlatformState } = await import('../lib/server/dev-store');
  const { createSeedPlatformState } = await import('../lib/server/platform-state');
  const { generateAndActivateWeeklyCycle, generateDailyDecisionForToday } = await import('../lib/server/planning/planning-store');

  const previousDatabase = process.env.DATABASE_URL;
  const previousStore = process.env.DECISIVE_PLATFORM_STORE_PATH;
  delete process.env.DATABASE_URL;
  process.env.DECISIVE_PLATFORM_STORE_PATH = '/tmp/decisive-planner-active-context.json';
  try {
    const state = createSeedPlatformState();
    state.users.push({ id: 'user_1', email: 'athlete@example.com', displayName: 'Athlete', password: 'secret123', workspaceId: 'workspace_1' });
    state.intervalsConnections.push({ id: 'conn_1', userId: 'user_1', externalAthleteId: '17634020', credentialPayload: 'api_key=xyz', syncStatus: 'ready', createdAt: '2026-04-20T00:00:00Z' });
    state.intervalsSnapshots.push({
      id: 'snap_1',
      userId: 'user_1',
      connectionId: 'conn_1',
      sourceJobId: 'job_1',
      capturedAt: '2026-04-20T00:05:00Z',
      liveState: {
        today: '2026-04-20',
        athlete_id: '17634020',
        goal_race_date: '2026-05-12',
        season_focus: 'repeatability',
        season_phase: 'build',
        wellness: { ctl: 102, atl: 110 },
        recent_rows: [
          { activity_id: 'a1', start_date_local: '2026-04-20T09:00:00', session_type: 'threshold / race-support ride', training_load: 140, duration_s: 7200, summary: { short_label: '3x15 threshold' } },
        ],
      } as any,
    });
    await savePlatformState(state);
    await savePlanningContext('user_1', {
      disciplineFocus: 'track_endurance',
      thresholdAnchorW: 365,
      preferredRestDay: 'Saturday',
      preferredLongRideDay: 'Sunday',
      maxWeeklyHours: 10,
      noBackToBackHardDays: true,
      blankDayDefault: 'support_endurance',
    });
    await generateAndActivateWeeklyCycle('user_1');
    await generateDailyDecisionForToday('user_1');

    const context = await getActivePlanningContext('user_1');
    assert.equal(Boolean(context?.cycle), true);
    assert.equal(Boolean(context?.todayDecision), true);
    assert.equal(Boolean(context?.summary), true);
    assert.match(context?.summary?.weekIntention || '', /repeatability|threshold|race/i);
    assert.equal(context?.summary?.plannedToday, context?.todayDecision?.plannedForToday);
    assert.equal(context?.summary?.actualToday, context?.todayDecision?.actualRecommendationForToday);
    assert.equal(context?.summary?.plannedTomorrow, context?.todayDecision?.plannedForTomorrow);
    assert.equal(context?.summary?.likelyTomorrow, context?.todayDecision?.likelyTomorrowAfterToday);
    assert.equal(context?.summary?.confidence, context?.todayDecision?.confidence);
    assert.equal(context?.summary?.nextKeyDay, context?.todayDecision?.recommendedNextKeyDay);
    assert.deepEqual(context?.summary?.risks, context?.todayDecision?.risks);
  } finally {
    if (previousDatabase) process.env.DATABASE_URL = previousDatabase; else delete process.env.DATABASE_URL;
    if (previousStore) process.env.DECISIVE_PLATFORM_STORE_PATH = previousStore; else delete process.env.DECISIVE_PLATFORM_STORE_PATH;
  }
});
