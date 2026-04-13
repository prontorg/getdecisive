import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAdaptationPayload,
  buildGoalPayload,
  buildPlannerDayPayload,
  buildPowerProfilePayload,
} from '../lib/server/planner-data';
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
