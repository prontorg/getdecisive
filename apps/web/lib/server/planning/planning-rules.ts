import type { LiveRow } from '../live-state';
import type {
  PlannedType,
  PlanningConfidence,
  PlanningInputSnapshot,
  PlanningPhaseType,
  StablePlanningContext,
} from './types';

function sessionTypeKey(row: LiveRow): string {
  return row.session_type || 'Other';
}

export function recentSessionCounts(rows: LiveRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = sessionTypeKey(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export function freshnessBandFromForm(form: number): PlanningInputSnapshot['liveContext']['freshnessBand'] {
  if (form <= -18) return 'heavy_fatigue';
  if (form <= -6) return 'manageable_fatigue';
  if (form < 6) return 'neutral';
  return 'fresh';
}

export function defaultKeySessionCount(input: PlanningInputSnapshot): number {
  const phase = resolvePhaseType(input);
  if (phase === 'taper' || phase === 'race_week') return 1;
  const maxHardDays = input.athleteContext.hardDaysMaxPerWeek || 2;
  return Math.max(1, Math.min(2, maxHardDays));
}

export function resolvePhaseType(input: PlanningInputSnapshot): PlanningPhaseType {
  const objective = `${input.goalContext.currentBlockObjective || ''} ${input.goalContext.currentPhase || ''}`.toLowerCase();
  const today = input.liveContext.today;
  const keyDate = input.goalContext.keyEventDate || input.liveContext.goalRaceDate;
  const daysToGoal = keyDate ? Math.round((Date.parse(`${keyDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) : null;
  if (objective.includes('rebuild')) return 'rebuild';
  if (objective.includes('absorb') || objective.includes('recovery')) return 'absorb';
  if (objective.includes('taper')) return 'taper';
  if (daysToGoal !== null && daysToGoal <= 7) return 'race_week';
  return 'build';
}

export function resolveWeeklyFocus(input: PlanningInputSnapshot): { primaryFocus: string; secondaryFocus?: string } {
  const objective = (input.goalContext.currentBlockObjective || '').toLowerCase();
  if (objective.includes('repeat')) return { primaryFocus: 'repeatability', secondaryFocus: 'threshold support' };
  if (objective.includes('threshold')) return { primaryFocus: 'threshold support', secondaryFocus: 'freshness protection' };
  if (objective.includes('race')) return { primaryFocus: 'race specificity', secondaryFocus: 'repeatability' };
  if (objective.includes('aerobic') || objective.includes('endurance')) return { primaryFocus: 'aerobic support', secondaryFocus: 'freshness protection' };
  if (resolvePhaseType(input) === 'race_week') return { primaryFocus: 'race specificity', secondaryFocus: 'freshness protection' };
  return { primaryFocus: 'repeatability', secondaryFocus: 'threshold support' };
}

export function fallbackPlannedTypeForOpenDay(context: StablePlanningContext): PlannedType {
  return context.blankDayDefault === 'rest' ? 'rest' : 'endurance';
}

export function isHardDay(type: PlannedType): boolean {
  return type === 'threshold_support' || type === 'repeatability' || type === 'race_like' || type === 'sharpness';
}

export function canPlaceHardDay(existingDays: Array<{ date: string; plannedType: PlannedType }>, candidateDate: string, context: StablePlanningContext): boolean {
  if (!context.noBackToBackHardDays) return true;
  const candidateTime = Date.parse(`${candidateDate}T00:00:00Z`);
  return !existingDays.some((day) => {
    if (!isHardDay(day.plannedType)) return false;
    const diff = Math.abs(Date.parse(`${day.date}T00:00:00Z`) - candidateTime) / 86400000;
    return diff === 1;
  });
}

export function shouldMoveMissedSession(args: {
  missedDayType: PlannedType;
  freshnessBand: PlanningInputSnapshot['liveContext']['freshnessBand'];
  hasFutureLandingSpot: boolean;
}): boolean {
  if (!isHardDay(args.missedDayType)) return false;
  if (!args.hasFutureLandingSpot) return false;
  return args.freshnessBand === 'neutral' || args.freshnessBand === 'fresh';
}

export function downgradeForFatigue(day: { plannedType: PlannedType; plannedLabel: string }, liveContext: PlanningInputSnapshot['liveContext']): { plannedType: PlannedType; plannedLabel: string } {
  if (!isHardDay(day.plannedType)) return day;
  if (liveContext.freshnessBand === 'heavy_fatigue') {
    return { plannedType: 'endurance', plannedLabel: 'Support endurance' };
  }
  if (liveContext.freshnessBand === 'manageable_fatigue' && day.plannedType === 'repeatability') {
    return { plannedType: 'threshold_support', plannedLabel: 'Controlled threshold support' };
  }
  return day;
}

export function confidenceFromInput(input: PlanningInputSnapshot): PlanningConfidence {
  if (!input.goalContext.keyEventDate) return 'medium';
  if (input.liveContext.recentRows.length < 2) return 'low';
  if (input.liveContext.freshnessBand === 'heavy_fatigue') return 'medium';
  return 'high';
}
