import type { MonthlyPlanWeek, MonthlyPlanWorkout } from './planner-customization';

function normalizeText(value?: string) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function plannedWorkoutFingerprint(workout: Pick<GeneratedWorkout, 'date' | 'category' | 'familyIntent' | 'intervalLabel' | 'label'>) {
  return [workout.date, workout.category, normalizeText(workout.familyIntent), normalizeText(workout.intervalLabel), normalizeText(workout.label)].join('|');
}

function completedWorkoutFingerprint(workout: Pick<GeneratedWorkout, 'date' | 'category' | 'label'>) {
  return [workout.date, workout.category, normalizeText(workout.label)].join('|');
}

type GeneratedWorkout = {
  date: string;
  label: string;
  intervalLabel?: string;
  familyIntent?: string;
  selectionRationale?: string[];
  category: MonthlyPlanWorkout['category'];
  durationMinutes?: number;
  targetLoad?: number;
  locked?: boolean;
  status?: MonthlyPlanWorkout['status'];
  reconciliationNote?: string;
  matchedPlannedWorkoutId?: string;
  matchedPlannedWorkoutLabel?: string;
  completedLabel?: string;
};

type GeneratedWeek = {
  weekIndex: 1 | 2 | 3 | 4;
  label: string;
  intent: string;
  weekTypeLabel?: string;
  targetHours: number;
  targetLoad: number;
  availableHours?: number;
  eventHours?: number;
  longSessionDay?: string;
  rationale: MonthlyPlanWeek['rationale'];
  completedThisWeek?: GeneratedWorkout[];
  workouts: GeneratedWorkout[];
};

export function toStoredCompletedWorkout(workout: GeneratedWorkout, weekIndex: number, index: number): MonthlyPlanWorkout {
  return {
    id: `cw_${weekIndex}_${index + 1}`,
    plannerSlotId: `completed_${weekIndex}_${index + 1}`,
    date: workout.date,
    label: workout.label,
    intervalLabel: workout.intervalLabel,
    familyIntent: workout.familyIntent,
    selectionRationale: workout.selectionRationale,
    category: workout.category,
    durationMinutes: workout.durationMinutes,
    targetLoad: workout.targetLoad,
    locked: true,
    source: 'completed',
    status: workout.status || 'completed',
    reconciliationNote: workout.reconciliationNote,
    matchedPlannedWorkoutId: workout.matchedPlannedWorkoutId,
    matchedPlannedWorkoutLabel: workout.matchedPlannedWorkoutLabel,
    completedLabel: workout.completedLabel,
  };
}

export function toStoredPlannedWorkout(workout: GeneratedWorkout, weekIndex: number, index: number, existing?: MonthlyPlanWorkout): MonthlyPlanWorkout {
  return {
    id: existing?.id || `w_${weekIndex}_${index + 1}`,
    plannerSlotId: existing?.plannerSlotId || `slot_${weekIndex}_${index + 1}_${Math.random().toString(36).slice(2, 8)}`,
    date: workout.date,
    label: workout.label,
    intervalLabel: workout.intervalLabel,
    familyIntent: workout.familyIntent,
    selectionRationale: workout.selectionRationale,
    category: workout.category,
    durationMinutes: workout.durationMinutes,
    targetLoad: workout.targetLoad,
    locked: existing?.locked ?? workout.locked ?? false,
    source: existing?.source || 'generated',
    status: workout.status || existing?.status || 'planned',
    reconciliationNote: workout.reconciliationNote || existing?.reconciliationNote,
    matchedPlannedWorkoutId: workout.matchedPlannedWorkoutId || existing?.matchedPlannedWorkoutId,
    matchedPlannedWorkoutLabel: workout.matchedPlannedWorkoutLabel || existing?.matchedPlannedWorkoutLabel,
    completedLabel: workout.completedLabel || existing?.completedLabel,
  };
}

function matchExistingPlannedWorkout(
  workout: GeneratedWorkout,
  existing: MonthlyPlanWorkout[] | undefined,
  usedPlannerSlotIds: Set<string>,
) {
  if (!existing?.length) return undefined;
  const nextFingerprint = plannedWorkoutFingerprint(workout);
  const candidates = [
    ...existing.filter((candidate) => plannedWorkoutFingerprint(candidate as GeneratedWorkout) === nextFingerprint),
    ...existing.filter((candidate) => candidate.date === workout.date && candidate.category === workout.category && normalizeText(candidate.familyIntent) === normalizeText(workout.familyIntent)),
    ...existing.filter((candidate) => candidate.date === workout.date && normalizeText(candidate.label) === normalizeText(workout.label)),
    ...existing.filter((candidate) => candidate.matchedPlannedWorkoutLabel && normalizeText(candidate.matchedPlannedWorkoutLabel) === normalizeText(workout.label)),
  ];
  return candidates.find((candidate, index) => candidates.findIndex((other) => other.plannerSlotId === candidate.plannerSlotId || other.id === candidate.id) === index && !usedPlannerSlotIds.has(candidate.plannerSlotId || candidate.id));
}

function matchExistingCompletedWorkout(
  workout: GeneratedWorkout,
  existing: MonthlyPlanWorkout[] | undefined,
  usedPlannerSlotIds: Set<string>,
) {
  if (!existing?.length) return undefined;
  const nextFingerprint = completedWorkoutFingerprint(workout);
  const candidates = [
    ...existing.filter((candidate) => completedWorkoutFingerprint(candidate as GeneratedWorkout) === nextFingerprint),
    ...existing.filter((candidate) => candidate.date === workout.date && normalizeText(candidate.label) === normalizeText(workout.label)),
  ];
  return candidates.find((candidate, index) => candidates.findIndex((other) => other.plannerSlotId === candidate.plannerSlotId || other.id === candidate.id) === index && !usedPlannerSlotIds.has(candidate.plannerSlotId || candidate.id));
}

export function toStoredWeekFromGenerated(generated: GeneratedWeek, existing?: MonthlyPlanWeek): MonthlyPlanWeek {
  const usedPlannerSlotIds = new Set<string>();
  const completedThisWeek = (generated.completedThisWeek || existing?.completedThisWeek || []).map((workout, index) => {
    const existingCompleted = matchExistingCompletedWorkout(workout as GeneratedWorkout, existing?.completedThisWeek, usedPlannerSlotIds);
    const storedCompleted = existingCompleted
      ? { ...existingCompleted, ...toStoredCompletedWorkout(workout as GeneratedWorkout, generated.weekIndex, index) }
      : toStoredCompletedWorkout(workout as GeneratedWorkout, generated.weekIndex, index);
    usedPlannerSlotIds.add(storedCompleted.plannerSlotId || storedCompleted.id);
    return storedCompleted;
  });

  const workouts = generated.workouts.map((workout, index) => {
    const existingWorkout = matchExistingPlannedWorkout(workout, existing?.workouts, usedPlannerSlotIds);
    const storedWorkout = toStoredPlannedWorkout(workout, generated.weekIndex, index, existingWorkout);
    usedPlannerSlotIds.add(storedWorkout.plannerSlotId || storedWorkout.id);
    return storedWorkout;
  });

  return {
    id: existing?.id || `week_${generated.weekIndex}`,
    weekIndex: generated.weekIndex,
    label: generated.label,
    intent: generated.intent,
    weekTypeLabel: generated.weekTypeLabel,
    targetHours: generated.targetHours,
    targetLoad: generated.targetLoad,
    availableHours: generated.availableHours,
    eventHours: generated.eventHours,
    longSessionDay: generated.longSessionDay,
    rationale: generated.rationale,
    completedThisWeek,
    workouts,
  };
}
