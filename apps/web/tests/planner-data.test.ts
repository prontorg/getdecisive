import test from 'node:test';
import assert from 'node:assert/strict';

import {
  authorizeLiveIntervalsState,
  buildAdaptationPayload,
  buildGoalPayload,
  buildPlannerDayPayload,
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

test('resolveAuthorizedLiveState prefers the user snapshot over the shared live source', () => {
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

  const resolved = resolveAuthorizedLiveState(context, { today: '2026-04-13', athlete_id: 'other-athlete' });

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
