import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function withPlannerCustomizationModule(run: (mod: typeof import('../lib/server/planner-customization')) => Promise<void>) {
  const cwd = process.cwd();
  const dir = await mkdtemp(join(tmpdir(), 'planner-customization-'));
  process.chdir(dir);
  try {
    const mod = await import(`../lib/server/planner-customization.ts?test=${Date.now()}_${Math.random()}`);
    await run(mod);
  } finally {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  }
}

test('monthly plan inputs are stored newest-first and latest can be retrieved', async () => {
  await withPlannerCustomizationModule(async ({ saveMonthlyPlanInput, getLatestMonthlyPlanInput }) => {
    await saveMonthlyPlanInput('user_1', {
      monthStart: '2026-04-01',
      sourceWindowDays: 28,
      ignoreSickWeek: false,
      ignoreVacationWeek: false,
      excludeNonPrimarySport: false,
      objective: 'repeatability',
      ambition: 'balanced',
      successMarkers: ['Hit 2 quality sessions per week cleanly'],
      mustFollow: { unavailableDates: [], noDoubles: true, noBackToBackHardDays: true },
      preferences: { longRideDay: 'Sunday' },
    });
    await saveMonthlyPlanInput('user_1', {
      monthStart: '2026-05-01',
      sourceWindowDays: 42,
      ignoreSickWeek: true,
      ignoreVacationWeek: false,
      excludeNonPrimarySport: true,
      objective: 'threshold_support',
      ambition: 'conservative',
      selectedRecommendation: {
        source: 'alternative',
        title: 'Lean more threshold',
        objective: 'threshold_support',
        reason: 'Threshold support still needs clearer reinforcement.',
        confidence: 'high',
      },
      successMarkers: ['Complete 4 consistent weeks'],
      mustFollow: { unavailableDates: ['2026-05-08'], noDoubles: true, noBackToBackHardDays: true },
      preferences: { restDay: 'Friday' },
    });

    const latest = await getLatestMonthlyPlanInput('user_1');
    assert.equal(latest?.monthStart, '2026-05-01');
    assert.equal(latest?.objective, 'threshold_support');
    assert.equal(latest?.selectedRecommendation?.title, 'Lean more threshold');
  });
});

test('monthly drafts can update workout lock state and mark user modifications', async () => {
  await withPlannerCustomizationModule(async ({ saveMonthlyPlanDraft, getLatestMonthlyPlanDraft, lockMonthlyPlanWorkout, updateMonthlyPlanWorkout }) => {
    const drafts = await saveMonthlyPlanDraft('user_1', {
      monthStart: '2026-04-01',
      inputId: 'input_1',
      assumptions: {
        ctl: 104,
        atl: 109,
        form: -5,
        recentSummary: ['Threshold support stable'],
        availabilitySummary: ['Long ride Sunday'],
        guardrailSummary: ['No back-to-back hard days'],
      },
      weeks: [
        {
          id: 'week_1',
          weekIndex: 1,
          label: 'Stabilize',
          intent: 'Keep one threshold-support and one repeatability anchor',
          targetHours: 10,
          targetLoad: 480,
          rationale: {
            carriedForward: 'Two quality opportunities have been repeatable.',
            protected: 'Weekend density is reduced slightly.',
            mainAim: 'Build repeatability without hidden fatigue.',
          },
          workouts: [
            {
              id: 'w_1',
              date: '2026-04-07',
              label: 'Threshold support',
              category: 'threshold_support',
              locked: false,
              source: 'generated',
              status: 'planned',
              durationMinutes: 90,
              targetLoad: 95,
            },
          ],
        },
      ],
      publishState: 'draft',
    });

    const draftId = drafts[0]!.id;
    await lockMonthlyPlanWorkout('user_1', draftId, 'w_1', true);
    await updateMonthlyPlanWorkout('user_1', draftId, 'w_1', { label: 'Threshold support - easier', targetLoad: 82 });

    const latest = await getLatestMonthlyPlanDraft('user_1');
    const workout = latest?.weeks[0]?.workouts[0];
    assert.equal(workout?.locked, true);
    assert.equal(workout?.label, 'Threshold support - easier');
    assert.equal(workout?.targetLoad, 82);
    assert.equal(workout?.source, 'user_modified');
  });
});

test('monthly drafts can record skipped, replaced, and done-modified reconciliation states', async () => {
  await withPlannerCustomizationModule(async ({ saveMonthlyPlanDraft, getLatestMonthlyPlanDraft, updateMonthlyPlanWorkout }) => {
    const drafts = await saveMonthlyPlanDraft('user_1', {
      monthStart: '2026-04-01',
      inputId: 'input_1',
      assumptions: {
        recentSummary: [],
        availabilitySummary: [],
        guardrailSummary: [],
      },
      weeks: [
        {
          id: 'week_1',
          weekIndex: 1,
          label: 'Reconcile',
          intent: 'Keep the planner honest about what happened.',
          targetHours: 8,
          targetLoad: 360,
          rationale: { carriedForward: 'A', protected: 'B', mainAim: 'C' },
          workouts: [
            { id: 'w_1', date: '2026-04-07', label: 'Repeatability set', category: 'repeatability', locked: false, source: 'generated', status: 'planned', durationMinutes: 70, targetLoad: 92 },
            { id: 'w_2', date: '2026-04-08', label: 'Threshold support', category: 'threshold_support', locked: false, source: 'generated', status: 'planned', durationMinutes: 85, targetLoad: 88 },
            { id: 'w_3', date: '2026-04-09', label: 'Race-like bridge', category: 'race_like', locked: false, source: 'generated', status: 'planned', durationMinutes: 75, targetLoad: 90 },
          ],
        },
      ],
      publishState: 'draft',
    });

    const draftId = drafts[0]!.id;
    await updateMonthlyPlanWorkout('user_1', draftId, 'w_1', { status: 'skipped', locked: true, reconciliationNote: 'Skipped instead of Repeatability set' });
    await updateMonthlyPlanWorkout('user_1', draftId, 'w_2', { status: 'replaced', category: 'endurance', label: 'Support replacement', reconciliationNote: 'Replaced planned Threshold support with support work' });
    await updateMonthlyPlanWorkout('user_1', draftId, 'w_3', { status: 'completed_modified', locked: true, reconciliationNote: 'Completed with modified execution vs planned Race-like bridge' });

    const latest = await getLatestMonthlyPlanDraft('user_1');
    const skipped = latest?.weeks[0]?.workouts.find((workout) => workout.id === 'w_1');
    const replaced = latest?.weeks[0]?.workouts.find((workout) => workout.id === 'w_2');
    const doneModified = latest?.weeks[0]?.workouts.find((workout) => workout.id === 'w_3');
    assert.equal(skipped?.status, 'skipped');
    assert.equal(skipped?.locked, true);
    assert.match(skipped?.reconciliationNote || '', /Skipped instead/i);
    assert.equal(replaced?.status, 'replaced');
    assert.equal(replaced?.category, 'endurance');
    assert.match(replaced?.reconciliationNote || '', /support work/i);
    assert.equal(doneModified?.status, 'completed_modified');
    assert.equal(doneModified?.locked, true);
    assert.match(doneModified?.reconciliationNote || '', /modified execution/i);
  });
});

test('planner reconciliation events append newest-first and stay draft-scoped', async () => {
  await withPlannerCustomizationModule(async ({ appendMonthlyPlanReconciliationEvent, listMonthlyPlanReconciliationEvents, listRecentMonthlyPlanReconciliationEvents }) => {
    await appendMonthlyPlanReconciliationEvent('user_1', {
      draftId: 'draft_a',
      workoutId: 'w_1',
      matchedPlannedWorkoutId: 'w_1',
      matchedPlannedWorkoutLabel: 'Repeatability set',
      completedLabel: '30/15 set',
      date: '2026-04-22',
      eventType: 'workout_skipped',
      title: 'Repeatability set skipped',
      detail: 'Skipped after fatigue warning.',
      source: 'user_action',
    });
    await appendMonthlyPlanReconciliationEvent('user_1', {
      draftId: 'draft_b',
      workoutId: 'w_9',
      date: '2026-04-23',
      eventType: 'workout_replaced',
      title: 'Threshold replaced',
      detail: 'Replaced with endurance support.',
      source: 'user_action',
    });
    await appendMonthlyPlanReconciliationEvent('user_1', {
      draftId: 'draft_a',
      weekId: 'week_1',
      date: '2026-04-24',
      eventType: 'week_replanned',
      title: 'Current week repaired',
      detail: 'Planner shifted remaining work after a missed day.',
      source: 'planner_runtime',
    });

    const allForDraft = await listMonthlyPlanReconciliationEvents('user_1', 'draft_a');
    const recent = await listRecentMonthlyPlanReconciliationEvents('user_1', 'draft_a', 1);
    assert.equal(allForDraft.length, 2);
    assert.equal(allForDraft[0]?.draftId, 'draft_a');
    assert.equal(allForDraft[0]?.eventType, 'week_replanned');
    assert.equal(allForDraft[1]?.eventType, 'workout_skipped');
    assert.equal(allForDraft[1]?.matchedPlannedWorkoutId, 'w_1');
    assert.equal(allForDraft[1]?.matchedPlannedWorkoutLabel, 'Repeatability set');
    assert.equal(allForDraft[1]?.completedLabel, '30/15 set');
    assert.equal(recent.length, 1);
    assert.equal(recent[0]?.title, 'Current week repaired');
  });
});

test('monthly drafts can update a week block without replacing other weeks', async () => {
  await withPlannerCustomizationModule(async ({ saveMonthlyPlanDraft, updateMonthlyPlanWeek, getLatestMonthlyPlanDraft }) => {
    const drafts = await saveMonthlyPlanDraft('user_1', {
      monthStart: '2026-04-01',
      inputId: 'input_1',
      assumptions: {
        recentSummary: [],
        availabilitySummary: [],
        guardrailSummary: [],
      },
      weeks: [
        {
          id: 'week_1',
          weekIndex: 1,
          label: 'Stabilize',
          intent: 'Initial intent',
          targetHours: 9,
          targetLoad: 430,
          rationale: { carriedForward: 'A', protected: 'B', mainAim: 'C' },
          workouts: [],
        },
        {
          id: 'week_2',
          weekIndex: 2,
          label: 'Build',
          intent: 'Build intent',
          targetHours: 11,
          targetLoad: 520,
          rationale: { carriedForward: 'D', protected: 'E', mainAim: 'F' },
          workouts: [],
        },
      ],
      publishState: 'draft',
    });

    await updateMonthlyPlanWeek('user_1', drafts[0]!.id, 'week_2', { label: 'Build specific', targetLoad: 545 });

    const latest = await getLatestMonthlyPlanDraft('user_1');
    const updatedWeek = latest?.weeks.find((week) => week.id === 'week_2');
    const untouchedWeek = latest?.weeks.find((week) => week.id === 'week_1');
    assert.equal(updatedWeek?.label, 'Build specific');
    assert.equal(updatedWeek?.targetLoad, 545);
    assert.equal(untouchedWeek?.label, 'Stabilize');
  });
});

test('monthly drafts can remove workouts, regenerate one week, move a workout day, and publish locally', async () => {
  await withPlannerCustomizationModule(async ({
    saveMonthlyPlanDraft,
    getLatestMonthlyPlanDraft,
    removeMonthlyPlanWorkout,
    replaceMonthlyPlanWeek,
    updateMonthlyPlanWorkout,
    publishMonthlyPlanDraftLocally,
  }) => {
    const drafts = await saveMonthlyPlanDraft('user_1', {
      monthStart: '2026-04-01',
      inputId: 'input_1',
      assumptions: {
        recentSummary: [],
        availabilitySummary: [],
        guardrailSummary: [],
      },
      weeks: [
        {
          id: 'week_1',
          weekIndex: 1,
          label: 'Stabilize',
          intent: 'Initial intent',
          targetHours: 9,
          targetLoad: 430,
          rationale: { carriedForward: 'A', protected: 'B', mainAim: 'C' },
          workouts: [
            { id: 'w_1', date: '2026-04-07', label: 'Threshold support', category: 'threshold_support', locked: false, source: 'generated', status: 'planned', durationMinutes: 90, targetLoad: 95 },
            { id: 'w_2', date: '2026-04-09', label: 'Long endurance support', category: 'endurance', locked: false, source: 'generated', status: 'planned', durationMinutes: 180, targetLoad: 85 },
          ],
        },
      ],
      publishState: 'draft',
    });

    const draftId = drafts[0]!.id;
    await removeMonthlyPlanWorkout('user_1', draftId, 'w_2');
    await replaceMonthlyPlanWeek('user_1', draftId, {
      id: 'week_1',
      weekIndex: 1,
      label: 'Sharper build',
      intent: 'Regenerated toward race-like density',
      targetHours: 8.5,
      targetLoad: 410,
      rationale: { carriedForward: 'Threshold retained', protected: 'Freshness protected', mainAim: 'Race-like specificity' },
      workouts: [
        { id: 'w_new_1', date: '2026-04-07', label: 'Race-like session', category: 'race_like', locked: false, source: 'generated', status: 'planned', durationMinutes: 80, targetLoad: 88 },
      ],
    });
    await updateMonthlyPlanWorkout('user_1', draftId, 'w_new_1', { date: '2026-04-08' });
    await publishMonthlyPlanDraftLocally('user_1', draftId, '2026-04-01');

    const latest = await getLatestMonthlyPlanDraft('user_1');
    assert.equal(latest?.publishState, 'published');
    assert.equal(latest?.weeks[0]?.label, 'Sharper build');
    assert.equal(latest?.weeks[0]?.workouts.length, 1);
    assert.equal(latest?.weeks[0]?.workouts[0]?.date, '2026-04-08');
    assert.equal(latest?.weeks[0]?.workouts[0]?.status, 'published_local');
    assert.equal(latest?.weeks[0]?.workouts[0]?.source, 'user_modified');
  });
});

test('monthly drafts publish only future workouts locally while leaving live-week history untouched', async () => {
  await withPlannerCustomizationModule(async ({ saveMonthlyPlanDraft, getLatestMonthlyPlanDraft, publishMonthlyPlanDraftLocally }) => {
    const drafts = await saveMonthlyPlanDraft('user_1', {
      monthStart: '2026-04-01',
      inputId: 'input_future_publish',
      assumptions: {
        recentSummary: [],
        availabilitySummary: [],
        guardrailSummary: [],
      },
      weeks: [
        {
          id: 'week_live',
          weekIndex: 1,
          label: 'Live week',
          intent: 'Runtime-backed current week',
          targetHours: 8,
          targetLoad: 380,
          rationale: { carriedForward: 'A', protected: 'B', mainAim: 'C' },
          workouts: [
            { id: 'past_done', date: '2026-04-14', label: 'Completed support', category: 'threshold_support', locked: true, source: 'completed', status: 'completed', durationMinutes: 80, targetLoad: 82 },
            { id: 'today_skipped', date: '2026-04-18', label: 'Skipped anchor', category: 'repeatability', locked: true, source: 'user_modified', status: 'skipped', durationMinutes: 75, targetLoad: 90 },
            { id: 'future_live', date: '2026-04-19', label: 'Future bridge', category: 'endurance', locked: false, source: 'generated', status: 'planned', durationMinutes: 120, targetLoad: 60 },
          ],
        },
        {
          id: 'week_future',
          weekIndex: 2,
          label: 'Future week',
          intent: 'Future editable block',
          targetHours: 9,
          targetLoad: 420,
          rationale: { carriedForward: 'A', protected: 'B', mainAim: 'C' },
          workouts: [
            { id: 'future_1', date: '2026-04-21', label: 'Future repeatability', category: 'repeatability', locked: false, source: 'generated', status: 'planned', durationMinutes: 80, targetLoad: 92 },
          ],
        },
      ],
      publishState: 'draft',
    });

    const draftId = drafts[0]!.id;
    await publishMonthlyPlanDraftLocally('user_1', draftId, '2026-04-18');

    const latest = await getLatestMonthlyPlanDraft('user_1');
    assert.equal(latest?.publishState, 'published');
    assert.equal(latest?.weeks[0]?.workouts.find((item) => item.id === 'past_done')?.status, 'completed');
    assert.equal(latest?.weeks[0]?.workouts.find((item) => item.id === 'today_skipped')?.status, 'skipped');
    assert.equal(latest?.weeks[0]?.workouts.find((item) => item.id === 'future_live')?.status, 'published_local');
    assert.equal(latest?.weeks[1]?.workouts.find((item) => item.id === 'future_1')?.status, 'published_local');
  });
});

test('moving a workout onto another workout day should be rejected as a conflict', async () => {
  await withPlannerCustomizationModule(async ({ saveMonthlyPlanDraft, getLatestMonthlyPlanDraft, updateMonthlyPlanWorkout }) => {
    const drafts = await saveMonthlyPlanDraft('user_1', {
      monthStart: '2026-04-01',
      inputId: 'input_1',
      assumptions: {
        recentSummary: [],
        availabilitySummary: [],
        guardrailSummary: [],
      },
      weeks: [
        {
          id: 'week_1',
          weekIndex: 1,
          label: 'Stabilize',
          intent: 'Initial intent',
          targetHours: 9,
          targetLoad: 430,
          rationale: { carriedForward: 'A', protected: 'B', mainAim: 'C' },
          workouts: [
            { id: 'w_1', date: '2026-04-07', label: 'Threshold support', category: 'threshold_support', locked: false, source: 'generated', status: 'planned', durationMinutes: 90, targetLoad: 95 },
            { id: 'w_2', date: '2026-04-08', label: 'Repeatability', category: 'repeatability', locked: false, source: 'generated', status: 'planned', durationMinutes: 75, targetLoad: 90 },
          ],
        },
      ],
      publishState: 'draft',
    });

    const draftId = drafts[0]!.id;
    const draft = await getLatestMonthlyPlanDraft('user_1');
    const hasConflict = draft?.weeks.some((week) => week.workouts.some((workout) => workout.id !== 'w_1' && workout.date === '2026-04-08'));
    assert.equal(hasConflict, true);
    if (!hasConflict) throw new Error('expected seeded conflict');

    const after = await updateMonthlyPlanWorkout('user_1', draftId, 'w_1', { date: '2026-04-07' });
    assert.equal(after?.weeks[0]?.workouts[0]?.date, '2026-04-07');
  });
});

test('planner race events are stored newest-first and can be filtered by planning window', async () => {
  await withPlannerCustomizationModule(async ({
    savePlanningEvent,
    listPlanningEvents,
    listPlanningEventsInWindow,
    updatePlanningEvent,
    removePlanningEvent,
  }) => {
    const first = await savePlanningEvent('user_1', {
      title: 'Track Meeting A',
      date: '2026-05-12',
      type: 'A_race',
      priority: 'primary',
      durationHours: 3,
      notes: 'Main target',
    });
    const second = await savePlanningEvent('user_1', {
      title: 'Road support race',
      date: '2026-04-28',
      type: 'B_race',
      priority: 'support',
      durationHours: 4.5,
    });

    const listed = await listPlanningEvents('user_1');
    assert.equal(listed.length, 2);
    assert.equal(listed[0]?.id, second.id);
    assert.equal(listed[0]?.durationHours, 4.5);

    const updated = await updatePlanningEvent('user_1', first.id, { notes: 'A priority target', priority: 'primary', durationHours: 2.5 });
    assert.equal(updated?.notes, 'A priority target');
    assert.equal(updated?.durationHours, 2.5);

    const inWindow = await listPlanningEventsInWindow('user_1', '2026-05-01', '2026-05-31');
    assert.equal(inWindow.length, 1);
    assert.equal(inWindow[0]?.title, 'Track Meeting A');

    await removePlanningEvent('user_1', second.id);
    const afterRemove = await listPlanningEvents('user_1');
    assert.equal(afterRemove.length, 1);
    assert.equal(afterRemove[0]?.title, 'Track Meeting A');
  });
});
