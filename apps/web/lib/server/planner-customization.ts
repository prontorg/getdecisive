import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { StablePlanningContext, PlanningCycle, DailyDecision, PlanningInputSnapshot } from './planning/types';

const STORE_PATH = join(process.cwd(), '.decisive-planner-customization.json');

type GoalEntry = {
  id: string;
  type: string;
  title: string;
  targetDate?: string;
  status: string;
  priority: 'A' | 'B' | 'support';
  notes?: string;
  updatedAt: string;
};

type AdaptationEntry = {
  id: string;
  date: string;
  status: 'green' | 'yellow' | 'red';
  legs: number;
  sleep: number;
  soreness: number;
  motivation: number;
  illness: boolean;
  note?: string;
  action: string;
  updatedAt: string;
};

type MonthlyPlanInput = {
  id: string;
  monthStart: string;
  createdAt: string;
  updatedAt: string;
  sourceWindowDays: 28 | 42;
  ignoreSickWeek: boolean;
  ignoreVacationWeek: boolean;
  excludeNonPrimarySport: boolean;
  objective:
    | 'repeatability'
    | 'threshold_support'
    | 'race_specificity'
    | 'aerobic_support'
    | 'rebuild'
    | 'consistency'
    | 'taper';
  ambition: 'conservative' | 'balanced' | 'ambitious';
  selectedRecommendation?: {
    source: 'primary' | 'alternative' | 'manual';
    title: string;
    objective: MonthlyPlanInput['objective'];
    reason?: string;
    confidence?: 'low' | 'medium' | 'high';
  };
  successMarkers: string[];
  note?: string;
  mustFollow: {
    unavailableDates: string[];
    maxWeeklyHours?: number;
    maxWeekdayMinutes?: number;
    noDoubles: boolean;
    noBackToBackHardDays: boolean;
    injuryNote?: string;
  };
  preferences: {
    longRideDay?: string;
    strengthDays?: string[];
    outdoorWeekends?: boolean;
    twoKeySessions?: boolean;
    restDay?: string;
    restDaysPerWeek?: number;
    lighterWeekend?: boolean;
  };
};

type MonthlyPlanWorkout = {
  id: string;
  date: string;
  label: string;
  intervalLabel?: string;
  category: 'recovery' | 'endurance' | 'threshold_support' | 'repeatability' | 'race_like' | 'rest';
  durationMinutes?: number;
  targetLoad?: number;
  notes?: string;
  locked: boolean;
  source: 'generated' | 'user_modified' | 'completed';
  status: 'planned' | 'published_local' | 'published_intervals' | 'completed';
};

type MonthlyPlanWeek = {
  id: string;
  weekIndex: 1 | 2 | 3 | 4;
  label: string;
  intent: string;
  targetHours: number;
  targetLoad: number;
  longSessionDay?: string;
  completedThisWeek?: MonthlyPlanWorkout[];
  rationale: {
    carriedForward: string;
    protected: string;
    mainAim: string;
  };
  workouts: MonthlyPlanWorkout[];
};

type MonthlyPlanDraft = {
  id: string;
  monthStart: string;
  inputId: string;
  createdAt: string;
  updatedAt: string;
  assumptions: {
    goalEvent?: string;
    goalDate?: string;
    ctl?: number;
    atl?: number;
    form?: number;
    selectedRecommendationTitle?: string;
    selectedRecommendationObjective?: MonthlyPlanInput['objective'];
    selectedRecommendationReason?: string;
    selectedRecommendationConfidence?: 'low' | 'medium' | 'high';
    recentSummary: string[];
    availabilitySummary: string[];
    guardrailSummary: string[];
  };
  weeks: MonthlyPlanWeek[];
  publishState: 'draft' | 'published';
};

type PlanningEvent = {
  id: string;
  title: string;
  date: string;
  type: 'A_race' | 'B_race' | 'C_race' | 'training_camp' | 'travel' | 'blackout';
  priority: 'primary' | 'support' | 'optional';
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type PlannerCustomizationStore = {
  goalsByUser: Record<string, GoalEntry[]>;
  adaptationByUser: Record<string, AdaptationEntry[]>;
  planningContextByUser: Record<string, StablePlanningContext>;
  planningInputSnapshotsByUser: Record<string, PlanningInputSnapshot[]>;
  planningCyclesByUser: Record<string, PlanningCycle[]>;
  dailyDecisionsByUser: Record<string, DailyDecision[]>;
  monthlyInputsByUser: Record<string, MonthlyPlanInput[]>;
  monthlyDraftsByUser: Record<string, MonthlyPlanDraft[]>;
  planningEventsByUser: Record<string, PlanningEvent[]>;
};

export type { GoalEntry, AdaptationEntry, MonthlyPlanInput, MonthlyPlanWorkout, MonthlyPlanWeek, MonthlyPlanDraft, PlanningEvent, PlannerCustomizationStore };

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function createSeedStore(): PlannerCustomizationStore {
  return {
    goalsByUser: {},
    adaptationByUser: {},
    planningContextByUser: {},
    planningInputSnapshotsByUser: {},
    planningCyclesByUser: {},
    dailyDecisionsByUser: {},
    monthlyInputsByUser: {},
    monthlyDraftsByUser: {},
    planningEventsByUser: {},
  };
}

async function ensureStoreFile(): Promise<void> {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  try {
    await readFile(STORE_PATH, 'utf8');
  } catch {
    await writeFile(STORE_PATH, JSON.stringify(createSeedStore(), null, 2));
  }
}

export async function loadPlannerCustomizationStore(): Promise<PlannerCustomizationStore> {
  await ensureStoreFile();
  const raw = await readFile(STORE_PATH, 'utf8');
  const parsed = JSON.parse(raw) as Partial<PlannerCustomizationStore>;
  return {
    goalsByUser: parsed.goalsByUser || {},
    adaptationByUser: parsed.adaptationByUser || {},
    planningContextByUser: parsed.planningContextByUser || {},
    planningInputSnapshotsByUser: parsed.planningInputSnapshotsByUser || {},
    planningCyclesByUser: parsed.planningCyclesByUser || {},
    dailyDecisionsByUser: parsed.dailyDecisionsByUser || {},
    monthlyInputsByUser: parsed.monthlyInputsByUser || {},
    monthlyDraftsByUser: parsed.monthlyDraftsByUser || {},
    planningEventsByUser: parsed.planningEventsByUser || {},
  };
}

async function loadStore(): Promise<PlannerCustomizationStore> {
  return loadPlannerCustomizationStore();
}

export async function savePlannerCustomizationStore(store: PlannerCustomizationStore): Promise<void> {
  await ensureStoreFile();
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

async function saveStore(store: PlannerCustomizationStore): Promise<void> {
  await savePlannerCustomizationStore(store);
}

export async function getUserGoalEntries(userId: string): Promise<GoalEntry[]> {
  const store = await loadStore();
  return store.goalsByUser[userId] || [];
}

export async function getUserAdaptationEntries(userId: string): Promise<AdaptationEntry[]> {
  const store = await loadStore();
  return (store.adaptationByUser[userId] || []).sort((a, b) => b.date.localeCompare(a.date));
}

export async function addUserGoalEntry(
  userId: string,
  input: Omit<GoalEntry, 'id' | 'updatedAt'>,
): Promise<GoalEntry[]> {
  const store = await loadStore();
  const nextEntry: GoalEntry = {
    ...input,
    id: makeId('goal'),
    updatedAt: nowIso(),
  };
  const existing = store.goalsByUser[userId] || [];
  store.goalsByUser[userId] = [nextEntry, ...existing].slice(0, 12);
  await saveStore(store);
  return store.goalsByUser[userId];
}

export async function addUserAdaptationEntry(
  userId: string,
  input: Omit<AdaptationEntry, 'id' | 'updatedAt'>,
): Promise<AdaptationEntry[]> {
  const store = await loadStore();
  const nextEntry: AdaptationEntry = {
    ...input,
    id: makeId('adapt'),
    updatedAt: nowIso(),
  };
  const existing = store.adaptationByUser[userId] || [];
  store.adaptationByUser[userId] = [nextEntry, ...existing]
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 12);
  await saveStore(store);
  return store.adaptationByUser[userId];
}

export async function getPlanningContext(userId: string): Promise<StablePlanningContext | null> {
  const store = await loadStore();
  return store.planningContextByUser[userId] || null;
}

export async function savePlanningContext(userId: string, context: StablePlanningContext): Promise<StablePlanningContext> {
  const store = await loadStore();
  store.planningContextByUser[userId] = context;
  await saveStore(store);
  return store.planningContextByUser[userId]!;
}

export async function getLatestMonthlyPlanInput(userId: string): Promise<MonthlyPlanInput | null> {
  const store = await loadStore();
  return (store.monthlyInputsByUser[userId] || []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;
}

export async function saveMonthlyPlanInput(
  userId: string,
  input: Omit<MonthlyPlanInput, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<MonthlyPlanInput[]> {
  const store = await loadStore();
  const existing = store.monthlyInputsByUser[userId] || [];
  const now = nowIso();
  const nextEntry: MonthlyPlanInput = {
    ...input,
    id: input.id || makeId('month_input'),
    createdAt: existing.find((item) => item.id === input.id)?.createdAt || now,
    updatedAt: now,
  };
  store.monthlyInputsByUser[userId] = [nextEntry, ...existing.filter((item) => item.id !== nextEntry.id)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 12);
  await saveStore(store);
  return store.monthlyInputsByUser[userId];
}

export async function getLatestMonthlyPlanDraft(userId: string): Promise<MonthlyPlanDraft | null> {
  const store = await loadStore();
  return (store.monthlyDraftsByUser[userId] || []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;
}

export async function saveMonthlyPlanDraft(
  userId: string,
  draft: Omit<MonthlyPlanDraft, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<MonthlyPlanDraft[]> {
  const store = await loadStore();
  const existing = store.monthlyDraftsByUser[userId] || [];
  const now = nowIso();
  const nextEntry: MonthlyPlanDraft = {
    ...draft,
    id: draft.id || makeId('month_draft'),
    createdAt: existing.find((item) => item.id === draft.id)?.createdAt || now,
    updatedAt: now,
  };
  store.monthlyDraftsByUser[userId] = [nextEntry, ...existing.filter((item) => item.id !== nextEntry.id)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 12);
  await saveStore(store);
  return store.monthlyDraftsByUser[userId];
}

export async function updateMonthlyPlanWorkout(
  userId: string,
  draftId: string,
  workoutId: string,
  patch: Partial<MonthlyPlanWorkout>,
): Promise<MonthlyPlanDraft | null> {
  const store = await loadStore();
  const drafts = store.monthlyDraftsByUser[userId] || [];
  const target = drafts.find((item) => item.id === draftId);
  if (!target) return null;
  target.weeks = target.weeks.map((week) => ({
    ...week,
    workouts: week.workouts.map((workout) => workout.id === workoutId ? { ...workout, ...patch, source: 'user_modified' } : workout),
  }));
  target.updatedAt = nowIso();
  await saveStore(store);
  return target;
}

export async function lockMonthlyPlanWorkout(
  userId: string,
  draftId: string,
  workoutId: string,
  locked: boolean,
): Promise<MonthlyPlanDraft | null> {
  return updateMonthlyPlanWorkout(userId, draftId, workoutId, { locked });
}

export async function updateMonthlyPlanWeek(
  userId: string,
  draftId: string,
  weekId: string,
  patch: Partial<MonthlyPlanWeek>,
): Promise<MonthlyPlanDraft | null> {
  const store = await loadStore();
  const drafts = store.monthlyDraftsByUser[userId] || [];
  const target = drafts.find((item) => item.id === draftId);
  if (!target) return null;
  target.weeks = target.weeks.map((week) => week.id === weekId ? { ...week, ...patch } : week);
  target.updatedAt = nowIso();
  await saveStore(store);
  return target;
}

export async function replaceMonthlyPlanWeek(
  userId: string,
  draftId: string,
  nextWeek: MonthlyPlanWeek,
): Promise<MonthlyPlanDraft | null> {
  const store = await loadStore();
  const drafts = store.monthlyDraftsByUser[userId] || [];
  const target = drafts.find((item) => item.id === draftId);
  if (!target) return null;
  target.weeks = target.weeks.map((week) => week.id === nextWeek.id ? nextWeek : week);
  target.updatedAt = nowIso();
  await saveStore(store);
  return target;
}

export async function removeMonthlyPlanWorkout(
  userId: string,
  draftId: string,
  workoutId: string,
): Promise<MonthlyPlanDraft | null> {
  const store = await loadStore();
  const drafts = store.monthlyDraftsByUser[userId] || [];
  const target = drafts.find((item) => item.id === draftId);
  if (!target) return null;
  target.weeks = target.weeks.map((week) => ({
    ...week,
    workouts: week.workouts.filter((workout) => workout.id !== workoutId),
  }));
  target.updatedAt = nowIso();
  await saveStore(store);
  return target;
}

export async function publishMonthlyPlanDraftLocally(
  userId: string,
  draftId: string,
): Promise<MonthlyPlanDraft | null> {
  const store = await loadStore();
  const drafts = store.monthlyDraftsByUser[userId] || [];
  const target = drafts.find((item) => item.id === draftId);
  if (!target) return null;
  target.publishState = 'published';
  target.weeks = target.weeks.map((week) => ({
    ...week,
    workouts: week.workouts.map((workout) => ({
      ...workout,
      status: workout.status === 'published_intervals' ? 'published_intervals' : 'published_local',
    })),
  }));
  target.updatedAt = nowIso();
  await saveStore(store);
  return target;
}

export async function listPlanningEvents(userId: string): Promise<PlanningEvent[]> {
  const store = await loadStore();
  return (store.planningEventsByUser[userId] || []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function savePlanningEvent(
  userId: string,
  input: Omit<PlanningEvent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<PlanningEvent> {
  const store = await loadStore();
  const existing = store.planningEventsByUser[userId] || [];
  const now = nowIso();
  const nextEntry: PlanningEvent = {
    ...input,
    id: input.id || makeId('plan_event'),
    createdAt: existing.find((item) => item.id === input.id)?.createdAt || now,
    updatedAt: now,
  };
  store.planningEventsByUser[userId] = [nextEntry, ...existing.filter((item) => item.id !== nextEntry.id)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 32);
  await saveStore(store);
  return nextEntry;
}

export async function updatePlanningEvent(
  userId: string,
  eventId: string,
  patch: Partial<Omit<PlanningEvent, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<PlanningEvent | null> {
  const store = await loadStore();
  const events = store.planningEventsByUser[userId] || [];
  const target = events.find((item) => item.id === eventId);
  if (!target) return null;
  Object.assign(target, patch, { updatedAt: nowIso() });
  store.planningEventsByUser[userId] = events.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  await saveStore(store);
  return target;
}

export async function removePlanningEvent(userId: string, eventId: string): Promise<void> {
  const store = await loadStore();
  const events = store.planningEventsByUser[userId] || [];
  store.planningEventsByUser[userId] = events.filter((item) => item.id !== eventId);
  await saveStore(store);
}

export async function listPlanningEventsInWindow(userId: string, startDate: string, endDate: string): Promise<PlanningEvent[]> {
  const events = await listPlanningEvents(userId);
  return events
    .filter((item) => item.date >= startDate && item.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}
