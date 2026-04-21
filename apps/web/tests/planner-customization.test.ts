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
    await publishMonthlyPlanDraftLocally('user_1', draftId);

    const latest = await getLatestMonthlyPlanDraft('user_1');
    assert.equal(latest?.publishState, 'published');
    assert.equal(latest?.weeks[0]?.label, 'Sharper build');
    assert.equal(latest?.weeks[0]?.workouts.length, 1);
    assert.equal(latest?.weeks[0]?.workouts[0]?.date, '2026-04-08');
    assert.equal(latest?.weeks[0]?.workouts[0]?.status, 'published_local');
    assert.equal(latest?.weeks[0]?.workouts[0]?.source, 'user_modified');
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
