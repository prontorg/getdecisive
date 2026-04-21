import type { GoalEntry } from '../planner-customization';
import type { LiveRow, LiveState } from '../live-state';
import type { PlanningInputSnapshot, StablePlanningContext } from './types';
import { freshnessBandFromForm, recentSessionCounts } from './planning-rules';

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function mondayOf(dateString: string): Date {
  const d = new Date(`${dateString}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function currentWeekCompletedRows(liveState: LiveState): LiveRow[] {
  const today = liveState.today || todayIso();
  const monday = mondayOf(today);
  const start = isoDate(monday);
  return (liveState.recent_rows || []).filter((row) => {
    const day = row.start_date_local.slice(0, 10);
    return day >= start && day <= today;
  });
}

function classifyCompletedType(row: LiveRow): PlanningInputSnapshot['executionContext']['completedTypes'][number] {
  const text = `${row.session_type || ''} ${row.summary?.short_label || ''}`.toLowerCase();
  if (text.includes('rest')) return 'rest';
  if (text.includes('recovery')) return 'recovery';
  if (text.includes('repeatability') || text.includes('broken vo2') || text.includes('30/15')) return 'repeatability';
  if (text.includes('threshold') || text.includes('race-support')) return 'threshold_support';
  if (text.includes('race-like') || text.includes('race')) return 'race_like';
  if (text.includes('sharp')) return 'sharpness';
  return 'endurance';
}

function resolveGoalContext(goalEntries: GoalEntry[], liveState: LiveState, currentDirection?: string): PlanningInputSnapshot['goalContext'] {
  const primaryGoal = [...goalEntries]
    .sort((a, b) => (a.priority === 'A' ? -1 : 1) - (b.priority === 'A' ? -1 : 1) || (a.targetDate || '').localeCompare(b.targetDate || ''))[0];
  return {
    currentDirection: currentDirection || primaryGoal?.title,
    keyEventTitle: primaryGoal?.title,
    keyEventDate: primaryGoal?.targetDate || liveState.goal_race_date,
    currentBlockObjective: liveState.season_focus || currentDirection,
    currentPhase: liveState.season_phase,
    successMarkers: primaryGoal?.notes ? [primaryGoal.notes] : [],
  };
}

export function assemblePlanningInput(args: {
  userId: string;
  stableContext: StablePlanningContext;
  liveState: LiveState;
  goalEntries?: GoalEntry[];
  currentDirection?: string;
}): PlanningInputSnapshot {
  const ctl = Number(args.liveState.wellness?.ctl || 0);
  const atl = Number(args.liveState.wellness?.atl || 0);
  const form = ctl - atl;
  const recentRows = args.liveState.recent_rows || [];
  const completedRows = currentWeekCompletedRows(args.liveState);
  return {
    id: makeId('planning_input'),
    athleteId: args.userId,
    capturedAt: nowIso(),
    athleteContext: args.stableContext,
    goalContext: resolveGoalContext(args.goalEntries || [], args.liveState, args.currentDirection),
    liveContext: {
      today: args.liveState.today || todayIso(),
      ctl,
      atl,
      form,
      goalRaceDate: args.liveState.goal_race_date,
      recentRows,
      currentWeekCompletedRows: completedRows,
      recentSessionCounts: recentSessionCounts(recentRows),
      freshnessBand: freshnessBandFromForm(form),
      sourceLiveState: args.liveState,
    },
    executionContext: {
      completedSessionCount: completedRows.length,
      completedLoad: Math.round(completedRows.reduce((sum, row) => sum + Number(row.training_load || 0), 0)),
      completedTypes: completedRows.map(classifyCompletedType),
      missedKeySessions: 0,
    },
  };
}
