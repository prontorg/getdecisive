import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeMonthlyPlanRequestBody } from '../lib/server/monthly-plan-request';

test('monthly planner draft route normalizes form values so unchecked boxes become false and selected fields persist', () => {
  const form = new FormData();
  form.set('objective', 'threshold_support');
  form.set('ambition', 'conservative');
  form.set('maxWeeklyHours', '9.5');
  form.set('restDay', 'Friday');
  form.set('restDaysPerWeek', '2');
  form.set('longRideDay', 'Sunday');
  form.set('note', 'Keep one race-support touch');
  form.append('successMarkers', 'Complete 4 consistent weeks');

  const normalized = normalizeMonthlyPlanRequestBody(form, '2026-04-16');

  assert.equal(normalized.objective, 'threshold_support');
  assert.equal(normalized.ambition, 'conservative');
  assert.equal(normalized.mustFollow.maxWeeklyHours, 9.5);
  assert.equal(normalized.mustFollow.noDoubles, false);
  assert.equal(normalized.mustFollow.noBackToBackHardDays, false);
  assert.equal(normalized.preferences.restDay, 'Friday');
  assert.equal(normalized.preferences.restDaysPerWeek, 2);
  assert.equal(normalized.preferences.longRideDay, 'Sunday');
  assert.deepEqual(normalized.successMarkers, ['Complete 4 consistent weeks']);
  assert.equal(normalized.note, 'Keep one race-support touch');
});

test('monthly planner draft route treats checked boxes as enabled when normalizing browser form data', () => {
  const form = new FormData();
  form.set('noDoubles', 'on');
  form.set('noBackToBackHardDays', 'on');
  form.set('objective', 'repeatability');

  const normalized = normalizeMonthlyPlanRequestBody(form, '2026-04-16');

  assert.equal(normalized.mustFollow.noDoubles, true);
  assert.equal(normalized.mustFollow.noBackToBackHardDays, true);
  assert.equal(normalized.objective, 'repeatability');
  assert.equal(normalized.monthStart, '2026-04-01');
});
