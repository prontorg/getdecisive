import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

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

type PlannerCustomizationStore = {
  goalsByUser: Record<string, GoalEntry[]>;
  adaptationByUser: Record<string, AdaptationEntry[]>;
};

export type { GoalEntry, AdaptationEntry, PlannerCustomizationStore };

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

async function loadStore(): Promise<PlannerCustomizationStore> {
  await ensureStoreFile();
  const raw = await readFile(STORE_PATH, 'utf8');
  return JSON.parse(raw) as PlannerCustomizationStore;
}

async function saveStore(store: PlannerCustomizationStore): Promise<void> {
  await ensureStoreFile();
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2));
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
