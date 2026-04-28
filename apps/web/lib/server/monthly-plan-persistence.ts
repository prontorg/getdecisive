import type { MonthlyPlanWeek, MonthlyPlanWorkout } from './planner-customization';

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
      const existingCompleted = existing?.completedThisWeek?.[index];
      return existingCompleted
        ? { ...existingCompleted, ...toStoredCompletedWorkout(workout as GeneratedWorkout, generated.weekIndex, index) }
        : toStoredCompletedWorkout(workout as GeneratedWorkout, generated.weekIndex, index);
    }),
    workouts: generated.workouts.map((workout, index) => toStoredPlannedWorkout(workout, generated.weekIndex, index, existing?.workouts[index])),
  };
}
