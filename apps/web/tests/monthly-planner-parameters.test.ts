import test from 'node:test';
import assert from 'node:assert/strict';

import { coerceMonthlyPlannerParameters } from '../lib/planner/monthly-parameters';

test('coerceMonthlyPlannerParameters applies defaults and clamps scheduling fields', () => {
  const result = coerceMonthlyPlannerParameters({
    objective: 'repeatability',
    ambition: 'balanced',
    mustFollow: { noDoubles: true, noBackToBackHardDays: true, unavailableDates: [] },
    preferences: { restDaysPerWeek: 7 },
  }, '2026-04-24');

  assert.equal(result.monthStart, '2026-04-01');
  assert.equal(result.sourceWindowDays, 42);
  assert.equal(result.preferences.restDaysPerWeek, 3);
  assert.deepEqual(result.mustFollow.unavailableDates, []);
  assert.equal(result.mustFollow.noDoubles, true);
  assert.equal(result.mustFollow.noBackToBackHardDays, true);
});
