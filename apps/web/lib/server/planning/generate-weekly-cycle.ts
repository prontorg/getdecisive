import type { PlanningCycle, PlanningDay, PlannedType, PlanningInputSnapshot } from './types';
import { confidenceFromInput, defaultKeySessionCount, fallbackPlannedTypeForOpenDay, resolvePhaseType, resolveWeeklyFocus } from './planning-rules';

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
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

function weekdayName(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
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

function structureForType(type: PlannedType, thresholdAnchorW?: number): string | undefined {
  const threshold = thresholdAnchorW || 365;
  if (type === 'threshold_support') return `3x15min @ ${Math.round(threshold * 0.99)}-${Math.round(threshold * 1.01)}w`;
  if (type === 'repeatability') return `3x8x30/15 @ ${Math.round(threshold * 1.1)}w/${Math.round(threshold * 0.55)}w`;
  if (type === 'race_like') return '6x2min stochastic set + jumps';
  if (type === 'sharpness') return '6x8s starts';
  return undefined;
}

export function generateWeeklyCycle(input: PlanningInputSnapshot): PlanningCycle {
  const monday = mondayOf(input.liveContext.today);
  const phaseType = resolvePhaseType(input);
  const focus = resolveWeeklyFocus(input);
  const cycleId = makeId('planning_cycle');
  const preferredRest = input.athleteContext.preferredRestDay || 'Saturday';
  const keyCount = defaultKeySessionCount(input);
  const days: PlanningDay[] = [];
  let qualityPlaced = 0;

  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + offset);
    const dayName = weekdayName(date);
    let plannedType: PlannedType = fallbackPlannedTypeForOpenDay(input.athleteContext);
    let priority: PlanningDay['priority'] = 'support';
    if (dayName === preferredRest) {
      plannedType = 'rest';
      priority = 'optional';
    } else if (qualityPlaced < keyCount && (dayName === 'Tuesday' || dayName === 'Friday')) {
      plannedType = qualityPlaced === 0
        ? (focus.primaryFocus === 'threshold support' ? 'threshold_support' : focus.primaryFocus === 'race specificity' ? 'race_like' : 'repeatability')
        : (focus.secondaryFocus === 'threshold support' ? 'threshold_support' : focus.secondaryFocus === 'repeatability' ? 'repeatability' : 'endurance');
      if (plannedType !== 'endurance') {
        priority = 'key';
        qualityPlaced += 1;
      }
    } else if (dayName === (input.athleteContext.preferredLongRideDay || 'Sunday')) {
      plannedType = 'endurance';
    }

    days.push({
      id: makeId('planning_day'),
      athleteId: input.athleteId,
      planningCycleId: cycleId,
      date: isoDate(date),
      plannedType,
      plannedLabel: labelForType(plannedType),
      plannedStructure: structureForType(plannedType, input.athleteContext.thresholdAnchorW),
      plannedDurationMin: plannedType === 'rest' ? 0 : plannedType === 'endurance' ? 90 : 75,
      plannedDurationMax: plannedType === 'rest' ? 0 : plannedType === 'endurance' ? 240 : 110,
      plannedLoadMin: plannedType === 'rest' ? 0 : plannedType === 'endurance' ? 45 : 80,
      plannedLoadMax: plannedType === 'rest' ? 0 : plannedType === 'endurance' ? 130 : 150,
      priority,
      ifMissedPolicy: priority === 'key' ? 'move' : 'skip',
      fallbackIfFatigued: priority === 'key' ? 'Downgrade to support endurance.' : 'Keep it easy and supportive.',
      upgradeIfFresh: plannedType === 'endurance' ? 'Upgrade to a controlled quality slot only if the week still stays balanced.' : undefined,
      rationale: priority === 'key'
        ? `Key ${plannedType.replace('_', ' ')} slot to serve ${focus.primaryFocus}.`
        : plannedType === 'rest'
          ? 'Protect freshness and absorb the previous work.'
          : 'Support the key sessions and preserve repeatability across the week.',
      status: 'planned',
    });
  }

  return {
    id: cycleId,
    athleteId: input.athleteId,
    sourceSnapshotId: input.id,
    createdAt: nowIso(),
    validFrom: isoDate(monday),
    validTo: isoDate(new Date(Date.parse(`${isoDate(monday)}T00:00:00Z`) + 6 * 86400000)),
    status: 'active',
    generationReason: 'scheduled_weekly',
    primaryFocus: focus.primaryFocus,
    secondaryFocus: focus.secondaryFocus,
    phaseType,
    freshnessTarget: phaseType === 'race_week' ? 'arrive fresh enough to sharpen' : 'keep enough freshness for the second key session',
    specificityTarget: phaseType === 'race_week' ? 'race serving' : focus.primaryFocus,
    confidence: confidenceFromInput(input),
    rationale: [
      `Week built around ${focus.primaryFocus}.`,
      'Blank/open days stay supportive unless a deliberate key slot is needed.',
    ],
    risks: input.liveContext.freshnessBand === 'heavy_fatigue'
      ? ['Current fatigue is high enough that the second key slot may need downgrading.']
      : ['Main risk is adding hidden load around key sessions.'],
    days,
  };
}
