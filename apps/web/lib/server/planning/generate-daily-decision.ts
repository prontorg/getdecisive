import type { DailyDecision, PlanningCycle, PlanningDay, PlanningInputSnapshot, PlannedType } from './types';
import { downgradeForFatigue, isHardDay, shouldMoveMissedSession } from './planning-rules';

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function labelForType(type: PlannedType): string {
  switch (type) {
    case 'rest': return 'Rest day';
    case 'recovery': return 'Easy recovery support';
    case 'endurance': return 'Support endurance';
    case 'threshold_support': return 'Threshold support anchor';
    case 'repeatability': return 'Repeatability anchor';
    case 'race_like': return 'Race-like anchor';
    case 'sharpness': return 'Sharpness opener';
  }
}

function nextDay(cycle: PlanningCycle, today: string): PlanningDay | undefined {
  return cycle.days.find((day) => day.date > today);
}

function nextFutureKeyDay(cycle: PlanningCycle, today: string): PlanningDay | undefined {
  return cycle.days.find((day) => day.date > today && day.priority === 'key');
}

function completedSummary(input: PlanningInputSnapshot): string {
  if (!input.executionContext.completedSessionCount) return 'No completed sessions yet this week.';
  return `${input.executionContext.completedSessionCount} completed session${input.executionContext.completedSessionCount === 1 ? '' : 's'} for load ${input.executionContext.completedLoad}.`;
}

export function generateDailyDecision(args: { cycle: PlanningCycle; input: PlanningInputSnapshot }): DailyDecision {
  const { cycle, input } = args;
  const today = input.liveContext.today;
  const todayDay = cycle.days.find((day) => day.date === today) || cycle.days[0]!;
  const tomorrowDay = nextDay(cycle, today);
  const downgraded = downgradeForFatigue({ plannedType: todayDay.plannedType, plannedLabel: todayDay.plannedLabel }, input.liveContext);
  const todayCompletedHard = input.executionContext.completedTypes.some((type) => isHardDay(type));
  const moveMissedKey = shouldMoveMissedSession({
    missedDayType: todayDay.plannedType,
    freshnessBand: input.liveContext.freshnessBand,
    hasFutureLandingSpot: Boolean(nextFutureKeyDay(cycle, today)),
  });

  let actualRecommendation = downgraded.plannedLabel;
  let likelyTomorrow = tomorrowDay?.plannedLabel || 'Support endurance';
  const risks: string[] = [];

  if (downgraded.plannedType !== todayDay.plannedType) {
    actualRecommendation = downgraded.plannedLabel;
    risks.push('Fatigue is high enough that the intended key work may not land cleanly today.');
  } else if (todayCompletedHard && tomorrowDay && tomorrowDay.priority === 'key') {
    actualRecommendation = `${todayDay.plannedLabel} — but only if it still fits after today’s completed key load.`;
    likelyTomorrow = 'Support endurance';
    risks.push('Back-to-back demanding work would reduce repeatability and freshness.');
  } else if (input.liveContext.freshnessBand === 'fresh' && todayDay.plannedType === 'endurance') {
    actualRecommendation = 'Support endurance, but a controlled quality upgrade is available if the week still stays balanced.';
  }

  if (moveMissedKey && input.executionContext.missedKeySessions > 0) {
    risks.push('A missed key session may still need a cleaner landing spot later this week.');
  }

  const nextKey = nextFutureKeyDay(cycle, today);

  return {
    id: makeId('planning_decision'),
    athleteId: cycle.athleteId,
    planningCycleId: cycle.id,
    sourceSnapshotId: cycle.sourceSnapshotId,
    createdAt: nowIso(),
    decisionDate: today,
    plannedForToday: todayDay.plannedLabel,
    actualRecommendationForToday: actualRecommendation,
    plannedForTomorrow: tomorrowDay?.plannedLabel || 'Support endurance',
    likelyTomorrowAfterToday: likelyTomorrow,
    recommendedNextKeyDay: nextKey?.date,
    confidence: cycle.confidence,
    reasonSummary: `${completedSummary(input)} Freshness is ${input.liveContext.freshnessBand.replace('_', ' ')} and the week still needs to serve ${cycle.primaryFocus}.`,
    decisionBasis: {
      freshness: `Freshness band: ${input.liveContext.freshnessBand.replace('_', ' ')}.`,
      completedWork: completedSummary(input),
      missedWork: input.executionContext.missedKeySessions ? `${input.executionContext.missedKeySessions} key session(s) still unresolved.` : 'No unresolved missed key sessions.',
      raceDirection: `Current week still aims at ${cycle.primaryFocus}.`,
      weeklyBalance: todayCompletedHard ? 'Keep tomorrow supportive after today’s completed hard work.' : 'Protect spacing between demanding sessions.',
    },
    risks,
  };
}
