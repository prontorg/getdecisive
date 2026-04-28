import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { normalizeMonthlyPlanRequestBody } from '../lib/server/monthly-plan-request';

const webRoot = process.cwd();

test('monthly planner draft route normalizes form values so unchecked boxes become false and selected fields persist', () => {
  const form = new FormData();
  form.set('objective', 'threshold_support');
  form.set('selectedRecommendationSource', 'alternative');
  form.set('selectedRecommendationTitle', 'Lean more threshold');
  form.set('selectedRecommendationReason', 'Use this if you want the month anchored more clearly around threshold support and race support.');
  form.set('ambition', 'conservative');
  form.set('maxWeeklyHours', '9.5');
  form.set('maxWeekdayMinutes', '75');
  form.set('restDay', 'Friday');
  form.set('restDaysPerWeek', '2');
  form.set('longRideDay', 'Sunday');
  form.append('unavailableDates', '2026-04-30');
  form.append('unavailableDates', '2026-05-02');
  form.set('useLast28DaysOnly', 'on');
  form.set('ignoreSickWeek', 'on');
  form.set('ignoreVacationWeek', 'on');
  form.set('excludeNonPrimarySport', 'on');
  form.set('note', 'Keep one race-support touch');
  form.append('successMarkers', 'Complete 4 consistent weeks');

  const normalized = normalizeMonthlyPlanRequestBody(form, '2026-04-16');

  assert.equal(normalized.objective, 'threshold_support');
  assert.equal(normalized.selectedRecommendation?.source, 'alternative');
  assert.equal(normalized.selectedRecommendation?.title, 'Lean more threshold');
  assert.match(normalized.selectedRecommendation?.reason || '', /threshold support/i);
  assert.equal(normalized.ambition, 'conservative');
  assert.equal(normalized.sourceWindowDays, 28);
  assert.equal(normalized.ignoreSickWeek, true);
  assert.equal(normalized.ignoreVacationWeek, true);
  assert.equal(normalized.excludeNonPrimarySport, true);
  assert.equal(normalized.mustFollow.maxWeeklyHours, 9.5);
  assert.equal(normalized.mustFollow.maxWeekdayMinutes, 75);
  assert.deepEqual(normalized.mustFollow.unavailableDates, ['2026-04-30', '2026-05-02']);
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

test('draft generation entry points keep the same advanced month inputs across generate, refresh, and week regenerate paths', async () => {
  const [draftRouteSource, trainingPlanPageSource, weekRouteSource, replanRouteSource] = await Promise.all([
    readFile(join(webRoot, 'app/api/planner/month/draft/route.ts'), 'utf8'),
    readFile(join(webRoot, 'app/app/_components/training-plan-page.tsx'), 'utf8'),
    readFile(join(webRoot, 'app/api/planner/month/week/route.ts'), 'utf8'),
    readFile(join(webRoot, 'app/api/planner/month/replan/route.ts'), 'utf8'),
  ]);

  assert.match(draftRouteSource, /refresh_latest_input/i);
  assert.match(draftRouteSource, /getLatestMonthlyPlanInput/i);
  assert.match(draftRouteSource, /No saved planner inputs found to refresh/i);
  assert.match(trainingPlanPageSource, /staleDraftReason/i);
  assert.match(trainingPlanPageSource, /draftNeedsExplicitRefresh/i);
  assert.match(trainingPlanPageSource, /Refresh draft from latest live data/i);
  assert.match(trainingPlanPageSource, /Review stays read-only until you explicitly refresh this month from the latest live context\./i);

  for (const source of [draftRouteSource, weekRouteSource]) {
    assert.match(source, /maxWeekdayMinutes: latestInput\?\.mustFollow\.maxWeekdayMinutes|maxWeekdayMinutes: latestInput\.mustFollow\.maxWeekdayMinutes/i);
    assert.match(source, /unavailableDates: latestInput\?\.mustFollow\.unavailableDates|unavailableDates: latestInput\.mustFollow\.unavailableDates/i);
    assert.match(source, /restDay: latestInput\?\.preferences\.restDay|restDay: latestInput\.preferences\.restDay/i);
    assert.match(source, /restDaysPerWeek: latestInput\?\.preferences\.restDaysPerWeek|restDaysPerWeek: latestInput\.preferences\.restDaysPerWeek/i);
    assert.match(source, /longRideDay: latestInput\?\.preferences\.longRideDay|longRideDay: latestInput\.preferences\.longRideDay/i);
  }

  for (const source of [draftRouteSource, weekRouteSource, replanRouteSource]) {
    assert.match(source, /toStoredWeekFromGenerated/i);
  }

  for (const source of [weekRouteSource, replanRouteSource]) {
    assert.match(source, /appendMonthlyPlanReconciliationEvent/i);
  }
  assert.match(weekRouteSource, /intent === 'preview'/i);
  assert.match(weekRouteSource, /buildWeekActionPreview/i);
  assert.match(weekRouteSource, /Week mutation preview generated/i);
  assert.match(weekRouteSource, /summary: action === 'regenerate'/i);
  assert.match(weekRouteSource, /beforeHours: week\.targetHours/i);
  assert.match(weekRouteSource, /afterHours: nextWeek\.targetHours/i);
  assert.match(weekRouteSource, /keyProtectionSummary/i);
  assert.match(weekRouteSource, /freshnessSummary/i);
  assert.match(weekRouteSource, /eventType: action === 'regenerate' \? 'week_regenerated' : 'week_replanned'/i);
  assert.match(replanRouteSource, /eventType: 'week_replanned'/i);
});
