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

function matchExistingPlannedWorkout(workout: GeneratedWorkout, existing?: MonthlyPlanWorkout[]) {
  if (!existing?.length) return undefined;
  const nextFingerprint = plannedWorkoutFingerprint(workout);
  return existing.find((candidate) => plannedWorkoutFingerprint(candidate as GeneratedWorkout) === nextFingerprint)
    || existing.find((candidate) => candidate.date === workout.date && candidate.category === workout.category && normalizeText(candidate.familyIntent) === normalizeText(workout.familyIntent))
    || existing.find((candidate) => candidate.date === workout.date && normalizeText(candidate.label) === normalizeText(workout.label))
    || existing.find((candidate) => candidate.matchedPlannedWorkoutLabel && normalizeText(candidate.matchedPlannedWorkoutLabel) === normalizeText(workout.label));
}

function matchExistingCompletedWorkout(workout: GeneratedWorkout, existing?: MonthlyPlanWorkout[]) {
  if (!existing?.length) return undefined;
  const nextFingerprint = completedWorkoutFingerprint(workout);
  return existing.find((candidate) => completedWorkoutFingerprint(candidate as GeneratedWorkout) === nextFingerprint)
    || existing.find((candidate) => candidate.date === workout.date && normalizeText(candidate.label) === normalizeText(workout.label));
}

export function toStoredWeekFromGenerated(generated: GeneratedWeek, existing?: MonthlyPlanWeek): MonthlyPlanWeek {
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
    completedThisWeek: (generated.completedThisWeek || existing?.completedThisWeek || []).map((workout, index) => {
      const existingCompleted = matchExistingCompletedWorkout(workout as GeneratedWorkout, existing?.completedThisWeek);
      return existingCompleted
        ? { ...existingCompleted, ...toStoredCompletedWorkout(workout as GeneratedWorkout, generated.weekIndex, index) }
        : toStoredCompletedWorkout(workout as GeneratedWorkout, generated.weekIndex, index);
    }),
    workouts: generated.workouts.map((workout, index) => {
      const existingWorkout = matchExistingPlannedWorkout(workout, existing?.workouts);
      return toStoredPlannedWorkout(workout, generated.weekIndex, index, existingWorkout);
    }),
  };
}
