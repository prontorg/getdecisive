import test from 'node:test';
import assert from 'node:assert/strict';

import {
  authorizeLiveIntervalsState,
  buildAdaptationPayload,
  buildGoalPayload,
  buildPlannerDayPayload,
  buildPowerProfilePayload,
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
