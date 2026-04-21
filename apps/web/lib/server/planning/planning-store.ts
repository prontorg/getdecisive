import type { DailyDecision, PlanningCycle, PlanningInputSnapshot } from './types';
import { getPlanningContext, getUserGoalEntries, loadPlannerCustomizationStore, savePlannerCustomizationStore } from '../planner-customization';
import { getLatestSnapshotForUser } from '../sync-store';
import { getLatestIntervalsConnectionRecord, getPlatformState } from '../auth-store';
import { assemblePlanningInput } from './assemble-planning-input';
import { generateDailyDecision } from './generate-daily-decision';
import { generateWeeklyCycle } from './generate-weekly-cycle';

function nowIso() {
  return new Date().toISOString();
}

type PlannerRuntimeStore = Awaited<ReturnType<typeof loadPlannerCustomizationStore>>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isCycleActiveForToday(cycle: PlanningCycle | null, today?: string | null): boolean {
  if (!cycle || !today) return false;
  return cycle.status === 'active' && cycle.validFrom <= today && cycle.validTo >= today;
}

function isDecisionCurrentForToday(decision: DailyDecision | null, cycle: PlanningCycle | null, today?: string | null): boolean {
  if (!decision || !cycle || !today) return false;
  return decision.decisionDate === today && decision.planningCycleId === cycle.id;
}

function emptyArrays(store: PlannerRuntimeStore) {
  if (!(store as any).planningInputSnapshotsByUser) (store as any).planningInputSnapshotsByUser = {};
  if (!(store as any).planningCyclesByUser) (store as any).planningCyclesByUser = {};
  if (!(store as any).dailyDecisionsByUser) (store as any).dailyDecisionsByUser = {};
}

export async function savePlanningInputSnapshot(userId: string, snapshot: PlanningInputSnapshot): Promise<PlanningInputSnapshot> {
  const store = await loadPlannerCustomizationStore();
  emptyArrays(store);
  const items = (store as any).planningInputSnapshotsByUser[userId] || [];
  (store as any).planningInputSnapshotsByUser[userId] = [snapshot, ...items].slice(0, 20);
  await savePlannerCustomizationStore(store);
  return snapshot;
}

export async function getLatestPlanningInputSnapshot(userId: string): Promise<PlanningInputSnapshot | null> {
  const store = await loadPlannerCustomizationStore();
  emptyArrays(store);
  return ((store as any).planningInputSnapshotsByUser[userId] || [])[0] || null;
}

export async function savePlanningCycle(userId: string, cycle: PlanningCycle): Promise<PlanningCycle> {
  const store = await loadPlannerCustomizationStore();
  emptyArrays(store);
  const existing: PlanningCycle[] = clone((store as any).planningCyclesByUser[userId] || []);
  const next = existing.map((item) => item.status === 'active' ? { ...item, status: 'superseded' as const, supersededBy: cycle.id } : item);
  (store as any).planningCyclesByUser[userId] = [cycle, ...next.filter((item) => item.id !== cycle.id)].slice(0, 12);
  await savePlannerCustomizationStore(store);
  return cycle;
}

export async function getActivePlanningCycle(userId: string): Promise<PlanningCycle | null> {
  const store = await loadPlannerCustomizationStore();
  emptyArrays(store);
  const items: PlanningCycle[] = (store as any).planningCyclesByUser[userId] || [];
  return items.find((item) => item.status === 'active') || null;
}

export async function saveDailyDecision(userId: string, decision: DailyDecision): Promise<DailyDecision> {
  const store = await loadPlannerCustomizationStore();
  emptyArrays(store);
  const items = (store as any).dailyDecisionsByUser[userId] || [];
  (store as any).dailyDecisionsByUser[userId] = [decision, ...items.filter((item: DailyDecision) => item.id !== decision.id)].slice(0, 20);
  await savePlannerCustomizationStore(store);
  return decision;
}

export async function getLatestDailyDecision(userId: string): Promise<DailyDecision | null> {
  const store = await loadPlannerCustomizationStore();
  emptyArrays(store);
  return ((store as any).dailyDecisionsByUser[userId] || [])[0] || null;
}

async function resolveCurrentLiveDay(userId: string): Promise<string | null> {
  const connection = await getLatestIntervalsConnectionRecord(userId);
  if (!connection) return null;
  const platformState = await getPlatformState();
  const snapshotRecord = await getLatestSnapshotForUser(userId, connection.id, platformState.intervalsSnapshots);
  return snapshotRecord?.liveState?.today || null;
}

export async function ensureCurrentPlanningContext(userId: string): Promise<{ cycle: PlanningCycle | null; decision: DailyDecision | null }> {
  let cycle = await getActivePlanningCycle(userId);
  let decision = await getLatestDailyDecision(userId);
  const today = await resolveCurrentLiveDay(userId);

  if (!isCycleActiveForToday(cycle, today)) cycle = null;
  if (!isDecisionCurrentForToday(decision, cycle, today)) decision = null;

  if (!cycle || !decision) {
    const generated = await generateDailyDecisionForToday(userId);
    cycle = generated?.cycle || cycle;
    decision = generated?.decision || decision;
  }

  return { cycle: cycle || null, decision: decision || null };
}

export async function generateAndActivateWeeklyCycle(userId: string): Promise<{ snapshot: PlanningInputSnapshot; cycle: PlanningCycle } | null> {
  const stableContext = await getPlanningContext(userId);
  const connection = await getLatestIntervalsConnectionRecord(userId);
  if (!stableContext || !connection) return null;
  const platformState = await getPlatformState();
  const snapshotRecord = await getLatestSnapshotForUser(userId, connection.id, platformState.intervalsSnapshots);
  if (!snapshotRecord?.liveState) return null;
  const goalEntries = await getUserGoalEntries(userId);
  const snapshot = assemblePlanningInput({
    userId,
    stableContext,
    liveState: snapshotRecord.liveState,
    goalEntries,
  });
  const cycle = generateWeeklyCycle(snapshot);
  await savePlanningInputSnapshot(userId, snapshot);
  await savePlanningCycle(userId, cycle);
  return { snapshot, cycle };
}

export async function generateDailyDecisionForToday(userId: string): Promise<{ cycle: PlanningCycle; decision: DailyDecision } | null> {
  let cycle = await getActivePlanningCycle(userId);
  let snapshot = await getLatestPlanningInputSnapshot(userId);
  const connection = await getLatestIntervalsConnectionRecord(userId);
  const platformState = connection ? await getPlatformState() : null;
  const latestSnapshotRecord = connection && platformState
    ? await getLatestSnapshotForUser(userId, connection.id, platformState.intervalsSnapshots)
    : null;
  const liveToday = latestSnapshotRecord?.liveState?.today || null;
  const snapshotToday = snapshot?.liveContext.today || null;

  if (!isCycleActiveForToday(cycle, liveToday || snapshotToday)) {
    cycle = null;
    snapshot = null;
  }

  if (cycle && latestSnapshotRecord?.liveState && snapshotToday !== liveToday) {
    const stableContext = await getPlanningContext(userId);
    if (stableContext) {
      const goalEntries = await getUserGoalEntries(userId);
      snapshot = assemblePlanningInput({
        userId,
        stableContext,
        liveState: latestSnapshotRecord.liveState,
        goalEntries,
      });
      await savePlanningInputSnapshot(userId, snapshot);
    }
  }

  if (!cycle || !snapshot) {
    const generated = await generateAndActivateWeeklyCycle(userId);
    if (!generated) return null;
    cycle = generated.cycle;
    snapshot = generated.snapshot;
  }
  const decision = generateDailyDecision({ cycle, input: snapshot });
  await saveDailyDecision(userId, decision);
  return { cycle, decision };
}
