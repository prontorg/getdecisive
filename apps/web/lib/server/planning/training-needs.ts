import type { LiveRow, LiveState } from '../live-state';

export type TrainingNeedKey = 'repeatability' | 'threshold_support' | 'race_specificity' | 'aerobic_durability' | 'anaerobic_support';
export type TrainingNeedStatus = 'needs_focus' | 'developing' | 'good';
export type FreshnessState = 'blocked' | 'constrained' | 'usable' | 'fresh';
export type EventPressure = 'far' | 'medium' | 'near' | 'taper';
export type DensityTolerance = 'low' | 'moderate' | 'high';
export type FatiguePressure = 'high' | 'elevated' | 'manageable' | 'low';
export type RecentRowCategory = 'repeatability' | 'threshold_support' | 'race_like' | 'endurance' | 'recovery' | 'rest';

type RecentRowSignals = {
  thresholdLike: boolean;
  repeatabilityLike: boolean;
  raceSpecificLike: boolean;
  longSupportLike: boolean;
  anaerobicLike: boolean;
};

type ClassifiedRecentRow = {
  row: LiveRow;
  category: RecentRowCategory;
  signals: RecentRowSignals;
};

type WeeklyVolumeSummary = {
  recentWeeklyHours: number;
  recentWeeklyLoad: number;
  weeklyHoursTarget: number;
};

type RecentPatternSummary = {
  hardDays: number;
  compressedStress: boolean;
  longSupportDays: number;
  keySessionMix: string[];
};

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
  recentPatternSummary: RecentPatternSummary;
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

function parseDate(value: string | undefined) {
  return value ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : null;
}

export function classifyRecentRow(row: LiveRow): RecentRowCategory {
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

export function classifyRecentRowSystem(row: LiveRow): RecentRowSignals {
  const sessionType = (row.session_type || '').toLowerCase();
  const label = `${row.summary?.short_label || ''} ${row.name || ''}`.toLowerCase();
  const combined = `${sessionType} ${label}`;
  const z2 = zoneSeconds(row, 'Z2');
  const z4 = zoneSeconds(row, 'Z4', 'SS');
  const z5 = zoneSeconds(row, 'Z5');
  const z6Plus = zoneSeconds(row, 'Z6', 'Z7');
  const load = Number(row.training_load || 0);
  const duration = Number(row.duration_s || 0);

  return {
    thresholdLike: /threshold|sweet ?spot|tempo|over.?under|race-support/i.test(combined) || z4 >= 20 * 60,
    repeatabilityLike: hasRepeatabilityMarkers(combined) || z5 >= 8 * 60 || (z5 >= 6 * 60 && load >= 95),
    raceSpecificLike: hasRaceSpecificMarkers(combined) || /race-like|stochastic/i.test(combined),
    longSupportLike: duration >= 2.5 * 3600 || z2 >= 90 * 60,
    anaerobicLike: /anaerobic|sprint|standing start|neuromuscular/i.test(combined) || z6Plus >= 90,
  };
}

function buildClassifiedRows(rows: LiveRow[]): ClassifiedRecentRow[] {
  return rows.map((row) => ({ row, category: classifyRecentRow(row), signals: classifyRecentRowSystem(row) }));
}

export function countHardDaysBySpacing(classified: ClassifiedRecentRow[]) {
  const hardDayKeys = new Set(classified
    .filter(({ category, row }) => category === 'repeatability' || category === 'threshold_support' || category === 'race_like' || Number(row.training_load || 0) >= 120)
    .map(({ row }) => row.start_date_local.slice(0, 10)));
  const hardDates = Array.from(hardDayKeys).sort();
  let compressedStress = false;
  for (let index = 1; index < hardDates.length; index += 1) {
    const gap = (parseDate(hardDates[index])!.getTime() - parseDate(hardDates[index - 1])!.getTime()) / 86400000;
    if (gap <= 1) {
      compressedStress = true;
      break;
    }
  }
  return {
    hardDays: hardDayKeys.size,
    compressedStress,
  };
}

export function summarizeWeeklyVolume(rows: LiveRow[], maxWeeklyHours?: number): WeeklyVolumeSummary {
  const recentHours = rows.reduce((acc, row) => acc + Number(row.duration_s || 0), 0) / 3600;
  const recentLoad = rows.reduce((acc, row) => acc + Number(row.training_load || 0), 0);
  const estimatedWeekCount = Math.min(4, Math.max(1, Math.ceil(rows.length / 3)));
  const weeklyHoursTarget = Math.max(7.5, Number(maxWeeklyHours || 10) * 0.72);

  return {
    recentWeeklyHours: rows.length ? recentHours / estimatedWeekCount : Number(maxWeeklyHours || 8),
    recentWeeklyLoad: rows.length ? recentLoad / estimatedWeekCount : 0,
    weeklyHoursTarget,
  };
}

function inferAerobicDurabilityStatus(input: {
  enduranceCount: number;
  longSupportDays: number;
  recentWeeklyHours: number;
  weeklyHoursTarget: number;
}): TrainingNeedStatus {
  const hasAdequateVolume = input.recentWeeklyHours >= input.weeklyHoursTarget;

  if (input.longSupportDays >= 2 && (hasAdequateVolume || input.enduranceCount >= 2)) return 'good';
  if (input.longSupportDays >= 1 || (input.enduranceCount >= 2 && hasAdequateVolume)) return 'developing';
  return 'needs_focus';
}

export function inferDensityTolerance(input: {
  freshnessState: FreshnessState;
  hardDays: number;
  compressedStress: boolean;
  longSupportDays: number;
  recentWeeklyHours: number;
  weeklyHoursTarget: number;
  enduranceCount: number;
}): DensityTolerance {
  if (input.freshnessState === 'blocked' || input.compressedStress) return 'low';
  if (input.freshnessState === 'constrained' || input.hardDays >= 3) return 'moderate';
  if (input.longSupportDays >= 2 && (input.recentWeeklyHours >= input.weeklyHoursTarget || input.enduranceCount >= 2)) return 'high';
  return 'moderate';
}

export function inferSystemStatus(input: {
  counts: TrainingNeedsSummary['counts'];
  classified: ClassifiedRecentRow[];
  eventPressure: EventPressure;
  recentWeeklyHours: number;
  weeklyHoursTarget: number;
  longSupportDays: number;
}): TrainingNeedsSummary['systemStatus'] {
  const thresholdSignals = input.classified.filter(({ signals }) => signals.thresholdLike).length;
  const repeatabilitySignals = input.classified.filter(({ signals }) => signals.repeatabilityLike).length;
  const raceSpecificSignals = input.classified.filter(({ signals }) => signals.raceSpecificLike).length;
  const anaerobicSignals = input.classified.filter(({ signals }) => signals.anaerobicLike).length;
  const aerobicDurability = inferAerobicDurabilityStatus({
    enduranceCount: input.counts.endurance,
    longSupportDays: input.longSupportDays,
    recentWeeklyHours: input.recentWeeklyHours,
    weeklyHoursTarget: input.weeklyHoursTarget,
  });

  return {
    repeatability: repeatabilitySignals >= 2 || input.counts.repeatability >= 2
      ? 'good'
      : repeatabilitySignals >= 1 || input.counts.repeatability === 1
        ? 'developing'
        : 'needs_focus',
    threshold_support: thresholdSignals >= 2 || input.counts.threshold_support >= 2
      ? 'good'
      : thresholdSignals >= 1 || input.counts.threshold_support === 1
        ? 'developing'
        : 'needs_focus',
    race_specificity: raceSpecificSignals >= 1 || input.counts.race_like >= 1
      ? 'good'
      : input.eventPressure === 'near' || input.eventPressure === 'taper'
        ? 'needs_focus'
        : 'developing',
    aerobic_durability: aerobicDurability,
    anaerobic_support: anaerobicSignals >= 2 ? 'good' : anaerobicSignals >= 1 ? 'developing' : 'needs_focus',
  };
}

export function inferPrimaryLimiters(input: {
  objective: string;
  systemStatus: TrainingNeedsSummary['systemStatus'];
  eventPressure: EventPressure;
  freshnessState: FreshnessState;
  densityTolerance: DensityTolerance;
}): TrainingNeedKey[] {
  const priorities: TrainingNeedKey[] = ['repeatability', 'threshold_support', 'race_specificity', 'aerobic_durability', 'anaerobic_support'];
  const objective = input.objective || 'repeatability';
  const ranked = [...priorities].sort((left, right) => {
    const statusScore = (key: TrainingNeedKey) => input.systemStatus[key] === 'needs_focus' ? 0 : input.systemStatus[key] === 'developing' ? 1 : 2;
    const objectiveBoost = (key: TrainingNeedKey) => {
      if (objective === 'race_specificity' && key === 'race_specificity') return -3;
      if (objective === 'threshold_support' && key === 'threshold_support') return -3;
      if (objective === 'repeatability' && key === 'repeatability') return -3;
      return 0;
    };
    const eventBoost = (key: TrainingNeedKey) => (input.eventPressure === 'near' || input.eventPressure === 'taper') && key === 'race_specificity' ? -2 : 0;
    const freshnessPenalty = (key: TrainingNeedKey) => (input.freshnessState === 'constrained' || input.densityTolerance === 'low') && key === 'race_specificity' ? 2 : 0;
    return (statusScore(left) + objectiveBoost(left) + eventBoost(left) + freshnessPenalty(left))
      - (statusScore(right) + objectiveBoost(right) + eventBoost(right) + freshnessPenalty(right));
  });

  const limiters = ranked.filter((key) => input.systemStatus[key] !== 'good');
  return limiters.length ? limiters : ['repeatability'];
}

export function inferProtectedStrengths(systemStatus: TrainingNeedsSummary['systemStatus']) {
  return (['repeatability', 'threshold_support', 'race_specificity', 'aerobic_durability'] as const)
    .filter((key) => systemStatus[key] === 'good');
}

export function inferDecisionNotes(input: {
  protectedStrengths: Array<Exclude<TrainingNeedKey, 'anaerobic_support'>>;
  systemStatus: TrainingNeedsSummary['systemStatus'];
  eventPressure: EventPressure;
  densityTolerance: DensityTolerance;
  compressedStress: boolean;
}): string[] {
  return [
    input.protectedStrengths.includes('threshold_support') ? 'protect_threshold_support' : null,
    input.protectedStrengths.includes('aerobic_durability') ? 'protect_aerobic_durability' : null,
    input.systemStatus.repeatability === 'needs_focus' ? 'raise_repeatability' : null,
    input.systemStatus.race_specificity === 'needs_focus' ? 'raise_race_specificity' : null,
    (input.eventPressure === 'near' || input.eventPressure === 'taper') ? 'respect_event_proximity' : null,
    input.compressedStress ? 'compressed_stress_recently' : null,
    input.densityTolerance === 'low'
      ? 'limit_quality_density'
      : input.densityTolerance === 'moderate'
        ? 'control_quality_density'
        : 'density_is_usable',
  ].filter(Boolean) as string[];
}

export function buildTrainingNeedsSummary(
  live: LiveState | null | undefined,
  input?: BuildTrainingNeedsInput,
): TrainingNeedsSummary {
  const rows = live?.recent_rows || [];
  const classified = buildClassifiedRows(rows);
  const counts = {
    repeatability: classified.filter(({ category }) => category === 'repeatability').length,
    threshold_support: classified.filter(({ category }) => category === 'threshold_support').length,
    race_like: classified.filter(({ category }) => category === 'race_like').length,
    endurance: classified.filter(({ category }) => category === 'endurance').length,
  };

  const volume = summarizeWeeklyVolume(rows, input?.mustFollow?.maxWeeklyHours);
  const form = Number(live?.wellness?.ctl || 0) - Number(live?.wellness?.atl || 0);
  const freshnessState: FreshnessState = form <= -18 ? 'blocked' : form <= -12 ? 'constrained' : form >= 4 ? 'fresh' : 'usable';
  const fatiguePressure: FatiguePressure = form <= -18 ? 'high' : form <= -10 ? 'elevated' : form <= -4 ? 'manageable' : 'low';

  const today = parseDate(live?.today || todayIso())!;
  const goalDate = parseDate(live?.goal_race_date);
  const daysToGoal = goalDate ? Math.round((goalDate.getTime() - today.getTime()) / 86400000) : 999;
  const eventPressure: EventPressure = daysToGoal <= 14 ? 'taper' : daysToGoal <= 35 ? 'near' : daysToGoal <= 70 ? 'medium' : 'far';

  const spacing = countHardDaysBySpacing(classified);
  const longSupportDays = classified.filter(({ signals }) => signals.longSupportLike).length;
  const densityTolerance = inferDensityTolerance({
    freshnessState,
    hardDays: spacing.hardDays,
    compressedStress: spacing.compressedStress,
    longSupportDays,
    recentWeeklyHours: volume.recentWeeklyHours,
    weeklyHoursTarget: volume.weeklyHoursTarget,
    enduranceCount: counts.endurance,
  });
  const systemStatus = inferSystemStatus({
    counts,
    classified,
    eventPressure,
    recentWeeklyHours: volume.recentWeeklyHours,
    weeklyHoursTarget: volume.weeklyHoursTarget,
    longSupportDays,
  });
  const primaryLimiters = inferPrimaryLimiters({
    objective: input?.objective || 'repeatability',
    systemStatus,
    eventPressure,
    freshnessState,
    densityTolerance,
  });
  const primaryLimiter = (primaryLimiters.find((key) => key !== 'anaerobic_support') || 'repeatability') as TrainingNeedsSummary['primaryLimiter'];
  const protectedStrengths = inferProtectedStrengths(systemStatus);
  const decisionNotes = inferDecisionNotes({
    protectedStrengths,
    systemStatus,
    eventPressure,
    densityTolerance,
    compressedStress: spacing.compressedStress,
  });

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
    recentWeeklyHours: volume.recentWeeklyHours,
    recentPatternSummary: {
      hardDays: spacing.hardDays,
      compressedStress: spacing.compressedStress,
      longSupportDays,
      keySessionMix,
    },
    decisionNotes,
  };
}
