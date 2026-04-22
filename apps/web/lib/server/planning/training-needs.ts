import type { LiveRow, LiveState } from '../live-state';

export type TrainingNeedKey = 'repeatability' | 'threshold_support' | 'race_specificity' | 'aerobic_durability' | 'anaerobic_support';
export type TrainingNeedStatus = 'needs_focus' | 'developing' | 'good';
export type FreshnessState = 'blocked' | 'constrained' | 'usable' | 'fresh';
export type EventPressure = 'far' | 'medium' | 'near' | 'taper';
export type DensityTolerance = 'low' | 'moderate' | 'high';
export type FatiguePressure = 'high' | 'elevated' | 'manageable' | 'low';

export type TrainingNeedsSummary = {
  freshnessState: FreshnessState;
  eventPressure: EventPressure;
  densityTolerance: DensityTolerance;
  fatiguePressure: FatiguePressure;
  primaryLimiter: Exclude<TrainingNeedKey, 'anaerobic_support'>;
  primaryLimiters: TrainingNeedKey[];
  protectedStrengths: Array<Exclude<TrainingNeedKey, 'anaerobic_support'>>;
  systemStatus: Record<TrainingNeedKey, TrainingNeedStatus>;
  counts: {
    repeatability: number;
    threshold_support: number;
    race_like: number;
    endurance: number;
  };
  recentWeeklyHours: number;
  recentPatternSummary: {
    hardDays: number;
    compressedStress: boolean;
    longSupportDays: number;
    keySessionMix: string[];
  };
  decisionNotes: string[];
};

type BuildTrainingNeedsInput = {
  objective?: string;
  currentDirection?: string;
  mustFollow?: { maxWeeklyHours?: number };
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function zoneSeconds(row: LiveRow, ...zones: string[]) {
  return zones.reduce((acc, zone) => acc + Number(row.zone_times?.[zone] || 0), 0);
}

function hasRaceSpecificMarkers(text: string) {
  return /points|scratch|race|stochastic|attacks|sprint|flying 200|match sprint|keirin|track start/i.test(text);
}

function hasRepeatabilityMarkers(text: string) {
  return /30\/?15|40\/?20|vo2|max aerobic|anaerobic|microburst|repeat|broken/i.test(text);
}

export function classifyRecentRow(row: LiveRow): 'repeatability' | 'threshold_support' | 'race_like' | 'endurance' | 'recovery' | 'rest' {
  const sessionType = (row.session_type || '').toLowerCase();
  const label = `${row.summary?.short_label || ''} ${row.name || ''}`.toLowerCase();
  const duration = Number(row.duration_s || 0);
  const load = Number(row.training_load || 0);
  const np = Number(row.weighted_avg_watts || row.average_watts || 0);
  const z2 = zoneSeconds(row, 'Z2');
  const z4 = zoneSeconds(row, 'Z4', 'SS');
  const z5 = zoneSeconds(row, 'Z5');
  const z6Plus = zoneSeconds(row, 'Z6', 'Z7');
  const highIntensity = z5 + z6Plus;
  const raceSpecific = hasRaceSpecificMarkers(`${sessionType} ${label}`);
  const repeatability = hasRepeatabilityMarkers(`${sessionType} ${label}`);

  if (sessionType.includes('rest')) return 'rest';
  if (sessionType.includes('recovery')) return 'recovery';
  if (sessionType.includes('repeatability') || sessionType.includes('broken vo2')) return 'repeatability';
  if (sessionType.includes('threshold') || sessionType.includes('race-support')) return 'threshold_support';
  if (sessionType.includes('race-like') || sessionType.includes('stochastic')) return 'race_like';
  if (sessionType.includes('race') && !sessionType.includes('race-support')) return 'race_like';

  if (repeatability || highIntensity >= 10 * 60 || (z5 >= 6 * 60 && !raceSpecific && load >= 95)) return 'repeatability';
  if (/threshold|sweet ?spot|tempo|over.?under|2x15|3x12|3x15/i.test(label) || z4 >= 20 * 60 || (np >= 330 && load >= 110)) return 'threshold_support';
  if (raceSpecific || ((z5 >= 6 * 60 || z6Plus >= 2 * 60) && load >= 100)) return 'race_like';
  if (duration <= 75 * 60 && load <= 40) return 'recovery';
  if (z2 >= 90 * 60 || duration >= 2.5 * 3600 || load >= 80) return 'endurance';
  return 'endurance';
}

function parseDate(value: string | undefined) {
  return value ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : null;
}

export function buildTrainingNeedsSummary(
  live: LiveState | null | undefined,
  input?: BuildTrainingNeedsInput,
): TrainingNeedsSummary {
  const rows = live?.recent_rows || [];
  const classified = rows.map((row) => ({ row, category: classifyRecentRow(row) }));
  const counts = {
    repeatability: classified.filter(({ category }) => category === 'repeatability').length,
    threshold_support: classified.filter(({ category }) => category === 'threshold_support').length,
    race_like: classified.filter(({ category }) => category === 'race_like').length,
    endurance: classified.filter(({ category }) => category === 'endurance').length,
  };

  const recentHours = rows.reduce((acc, row) => acc + Number(row.duration_s || 0), 0) / 3600;
  const recentWeeklyHours = rows.length ? recentHours / Math.min(4, Math.max(1, Math.ceil(rows.length / 3))) : Number(input?.mustFollow?.maxWeeklyHours || 8);
  const form = Number(live?.wellness?.ctl || 0) - Number(live?.wellness?.atl || 0);
  const freshnessState: FreshnessState = form <= -18 ? 'blocked' : form <= -12 ? 'constrained' : form >= 4 ? 'fresh' : 'usable';
  const fatiguePressure: FatiguePressure = form <= -18 ? 'high' : form <= -10 ? 'elevated' : form <= -4 ? 'manageable' : 'low';

  const today = parseDate(live?.today || todayIso())!;
  const goalDate = parseDate(live?.goal_race_date);
  const daysToGoal = goalDate ? Math.round((goalDate.getTime() - today.getTime()) / 86400000) : 999;
  const eventPressure: EventPressure = daysToGoal <= 14 ? 'taper' : daysToGoal <= 35 ? 'near' : daysToGoal <= 70 ? 'medium' : 'far';

  const hardDayKeys = new Set(classified
    .filter(({ category, row }) => category === 'repeatability' || category === 'threshold_support' || category === 'race_like' || Number(row.training_load || 0) >= 120)
    .map(({ row }) => row.start_date_local.slice(0, 10)));
  const hardDays = hardDayKeys.size;
  const hardDates = Array.from(hardDayKeys).sort();
  let compressedStress = false;
  for (let index = 1; index < hardDates.length; index += 1) {
    const gap = (parseDate(hardDates[index])!.getTime() - parseDate(hardDates[index - 1])!.getTime()) / 86400000;
    if (gap <= 1) {
      compressedStress = true;
      break;
    }
  }

  const longSupportDays = rows.filter((row) => Number(row.duration_s || 0) >= 2.5 * 3600 || zoneSeconds(row, 'Z2') >= 90 * 60).length;
  const densityTolerance: DensityTolerance = freshnessState === 'blocked' || compressedStress
    ? 'low'
    : freshnessState === 'constrained' || hardDays >= 3
      ? 'moderate'
      : longSupportDays >= 2 && recentWeeklyHours >= Math.max(7.5, Number(input?.mustFollow?.maxWeeklyHours || 10) * 0.72)
        ? 'high'
        : 'moderate';

  const anaerobicSignals = rows.filter((row) => /anaerobic|sprint|standing start|neuromuscular/i.test(`${row.summary?.short_label || ''} ${row.name || ''}`) || zoneSeconds(row, 'Z6', 'Z7') >= 90).length;
  const systemStatus: TrainingNeedsSummary['systemStatus'] = {
    repeatability: counts.repeatability >= 2 ? 'good' : counts.repeatability === 1 ? 'developing' : 'needs_focus',
    threshold_support: counts.threshold_support >= 2 ? 'good' : counts.threshold_support === 1 ? 'developing' : 'needs_focus',
    race_specificity: counts.race_like >= 1 ? 'good' : eventPressure === 'near' || eventPressure === 'taper' ? 'needs_focus' : 'developing',
    aerobic_durability: counts.endurance >= 2 && recentWeeklyHours >= Math.max(7.5, Number(input?.mustFollow?.maxWeeklyHours || 10) * 0.72) ? 'good' : counts.endurance >= 1 ? 'developing' : 'needs_focus',
    anaerobic_support: anaerobicSignals >= 1 ? 'developing' : 'needs_focus',
  };

  const priorities: TrainingNeedKey[] = ['repeatability', 'threshold_support', 'race_specificity', 'aerobic_durability', 'anaerobic_support'];
  const objective = input?.objective || 'repeatability';
  const primaryLimiter: TrainingNeedsSummary['primaryLimiter'] = objective === 'threshold_support'
    ? 'threshold_support'
    : objective === 'race_specificity'
      ? (systemStatus.race_specificity === 'needs_focus' ? 'race_specificity' : systemStatus.repeatability === 'needs_focus' ? 'repeatability' : 'threshold_support')
      : (priorities.find((key) => key !== 'anaerobic_support' && systemStatus[key] === 'needs_focus') as TrainingNeedsSummary['primaryLimiter'] | undefined) || 'repeatability';
  const primaryLimiters = [
    primaryLimiter,
    ...priorities.filter((key) => key !== primaryLimiter && systemStatus[key] === 'needs_focus'),
  ];
  const protectedStrengths = (['repeatability', 'threshold_support', 'race_specificity', 'aerobic_durability'] as const)
    .filter((key) => systemStatus[key] === 'good');

  const decisionNotes = [
    protectedStrengths.includes('threshold_support') ? 'protect_threshold_support' : null,
    systemStatus.repeatability === 'needs_focus' ? 'raise_repeatability' : null,
    eventPressure === 'near' || eventPressure === 'taper' ? 'respect_event_proximity' : null,
    densityTolerance === 'low' ? 'limit_quality_density' : densityTolerance === 'moderate' ? 'control_quality_density' : 'density_is_usable',
  ].filter(Boolean) as string[];

  const keySessionMix = [
    counts.repeatability ? `${counts.repeatability} repeatability` : null,
    counts.threshold_support ? `${counts.threshold_support} threshold` : null,
    counts.race_like ? `${counts.race_like} race-like` : null,
    counts.endurance ? `${counts.endurance} endurance` : null,
  ].filter(Boolean) as string[];

  return {
    freshnessState,
    eventPressure,
    densityTolerance,
    fatiguePressure,
    primaryLimiter,
    primaryLimiters,
    protectedStrengths,
    systemStatus,
    counts,
    recentWeeklyHours,
    recentPatternSummary: {
      hardDays,
      compressedStress,
      longSupportDays,
      keySessionMix,
    },
    decisionNotes,
  };
}
