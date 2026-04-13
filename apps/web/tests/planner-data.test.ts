import test from 'node:test';
import assert from 'node:assert/strict';

import {
  authorizeLiveIntervalsState,
  buildAdaptationPayload,
  buildGoalPayload,
  buildPlannerBlockPayload,
  buildPlannerDayPayload,
  buildPlannerWeekPayload,
  buildPowerProfilePayload,
  hydrateUserSnapshotFromSharedLive,
  resolveAuthorizedLiveState,
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

test('power profile payload points deep analysis to the dedicated analysis tab', () => {
  const payload = buildPowerProfilePayload();

  assert.equal(payload.analysisViewRoute, appRoutes.analysis);
  assert.equal(payload.recommendedEmphasisChanges.some((item) => /Analysis/.test(item)), true);
});

test('goal and adaptation payloads explain safe read-only behavior', () => {
  const goals = buildGoalPayload();
  const adaptation = buildAdaptationPayload();

  assert.equal(goals.activeGoals.length > 0, true);
  assert.equal(adaptation.manualReviewRecommended, true);
  assert.match(adaptation.userFacingExplanation, /read-only toward Intervals/i);
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
