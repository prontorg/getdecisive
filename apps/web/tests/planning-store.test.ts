import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

async function withIsolatedStore<T>(fn: () => Promise<T>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'decisive-planning-store-'));
  const previousStore = process.env.DECISIVE_PLATFORM_STORE_PATH;
  const previousDatabase = process.env.DATABASE_URL;
  process.env.DECISIVE_PLATFORM_STORE_PATH = path.join(dir, '.decisive-dev-store.json');
  delete process.env.DATABASE_URL;
  const previousCwd = process.cwd();
  process.chdir('/root/.hermes/profiles/profdecisive/workspace/decisive-platform/apps/web');
  try {
    return await fn();
  } finally {
    process.chdir(previousCwd);
    if (previousStore) process.env.DECISIVE_PLATFORM_STORE_PATH = previousStore;
    else delete process.env.DECISIVE_PLATFORM_STORE_PATH;
    if (previousDatabase) process.env.DATABASE_URL = previousDatabase;
    else delete process.env.DATABASE_URL;
  }
}

test('planning context store persists stable athlete planning inputs', async () => {
  await withIsolatedStore(async () => {
    const { savePlanningContext, getPlanningContext } = await import('../lib/server/planner-customization');
    await savePlanningContext('user_1', {
      disciplineFocus: 'track_endurance',
      thresholdAnchorW: 365,
      preferredRestDay: 'Saturday',
      maxWeeklyHours: 10,
      noBackToBackHardDays: true,
      blankDayDefault: 'support_endurance',
    });
    const saved = await getPlanningContext('user_1');
    assert.equal(saved?.thresholdAnchorW, 365);
    assert.equal(saved?.preferredRestDay, 'Saturday');
  });
});

test('planning store can save active cycles and latest daily decisions', async () => {
  await withIsolatedStore(async () => {
    const { savePlanningContext } = await import('../lib/server/planner-customization');
    const { savePlatformState } = await import('../lib/server/dev-store');
    const { createSeedPlatformState } = await import('../lib/server/platform-state');
    const { generateAndActivateWeeklyCycle, getActivePlanningCycle, generateDailyDecisionForToday, getLatestDailyDecision } = await import('../lib/server/planning/planning-store');

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

    const generated = await generateAndActivateWeeklyCycle('user_1');
    const active = await getActivePlanningCycle('user_1');
    const decisionBundle = await generateDailyDecisionForToday('user_1');
    const latestDecision = await getLatestDailyDecision('user_1');

    assert.equal(Boolean(generated?.cycle), true);
    assert.equal(active?.status, 'active');
    assert.equal(Boolean(decisionBundle?.decision), true);
    assert.equal(latestDecision?.planningCycleId, active?.id);
  });
});

test('ensureCurrentPlanningContext refreshes the daily decision when the live snapshot day advances inside the same active week', async () => {
  await withIsolatedStore(async () => {
    const { savePlanningContext } = await import('../lib/server/planner-customization');
    const { savePlatformState, loadPlatformState } = await import('../lib/server/dev-store');
    const { createSeedPlatformState } = await import('../lib/server/platform-state');
    const { generateAndActivateWeeklyCycle, generateDailyDecisionForToday, ensureCurrentPlanningContext } = await import('../lib/server/planning/planning-store');

    const state = createSeedPlatformState();
    state.users.push({ id: 'user_1', email: 'athlete@example.com', displayName: 'Athlete', password: 'secret123', workspaceId: 'workspace_1' });
    state.intervalsConnections.push({ id: 'conn_1', userId: 'user_1', externalAthleteId: '17634020', credentialPayload: 'api_key=xyz', syncStatus: 'ready', createdAt: '2026-04-20T00:00:00Z' });
    state.intervalsSnapshots.push({
      id: 'snap_1',
      userId: 'user_1',
      connectionId: 'conn_1',
      sourceJobId: 'job_1',
      capturedAt: '2026-04-28T00:05:00Z',
      liveState: {
        today: '2026-04-28',
        athlete_id: '17634020',
        goal_race_date: '2026-05-12',
        season_focus: 'repeatability',
        season_phase: 'build',
        wellness: { ctl: 102, atl: 110 },
        recent_rows: [
          { activity_id: 'a1', start_date_local: '2026-04-27T09:00:00', session_type: 'threshold / race-support ride', training_load: 140, duration_s: 7200, summary: { short_label: '3x15 threshold' } },
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

    const firstCycle = await generateAndActivateWeeklyCycle('user_1');
    const firstDecision = await generateDailyDecisionForToday('user_1');
    assert.equal(firstCycle?.cycle.validFrom, '2026-04-27');
    assert.equal(firstDecision?.decision.decisionDate, '2026-04-28');

    const nextState = await loadPlatformState();
    nextState.intervalsSnapshots = nextState.intervalsSnapshots.map((snapshot) => snapshot.id === 'snap_1'
      ? {
        ...snapshot,
        capturedAt: '2026-04-29T00:05:00Z',
        liveState: {
          ...snapshot.liveState,
          today: '2026-04-29',
          recent_rows: [
            ...(snapshot.liveState?.recent_rows || []),
            { activity_id: 'a2', start_date_local: '2026-04-28T09:00:00', session_type: 'endurance ride', training_load: 75, duration_s: 5400, summary: { short_label: 'Support endurance' } },
          ],
        },
      }
      : snapshot);
    await savePlatformState(nextState);

    const ensured = await ensureCurrentPlanningContext('user_1');
    assert.equal(ensured.cycle?.validFrom, '2026-04-27');
    assert.equal(ensured.decision?.decisionDate, '2026-04-29');
  });
});
