export type MonthlyPlannerObjective =
  | 'repeatability'
  | 'threshold_support'
  | 'race_specificity'
  | 'aerobic_support'
  | 'rebuild'
  | 'consistency'
  | 'taper';

export type MonthlyPlannerAmbition = 'conservative' | 'balanced' | 'ambitious';
export type MonthlyPlannerRecommendationSource = 'primary' | 'alternative' | 'manual';

export type MonthlyPlannerSelectedRecommendation = {
  source: MonthlyPlannerRecommendationSource;
  title: string;
  objective: MonthlyPlannerObjective;
  reason?: string;
  confidence?: 'low' | 'medium' | 'high';
};

export type MonthlyPlannerMustFollow = {
  unavailableDates: string[];
  maxWeeklyHours?: number;
  maxWeekdayMinutes?: number;
  noDoubles: boolean;
  noBackToBackHardDays: boolean;
  injuryNote?: string;
};

export type MonthlyPlannerPreferences = {
  longRideDay?: string;
  strengthDays?: string[];
  outdoorWeekends?: boolean;
  twoKeySessions?: boolean;
  restDay?: string;
  restDaysPerWeek?: number;
  lighterWeekend?: boolean;
};

export type MonthlyPlannerParameters = {
  monthStart: string;
  sourceWindowDays: 28 | 42;
  ignoreSickWeek: boolean;
  ignoreVacationWeek: boolean;
  excludeNonPrimarySport: boolean;
  objective: MonthlyPlannerObjective;
  ambition: MonthlyPlannerAmbition;
  selectedRecommendation?: MonthlyPlannerSelectedRecommendation;
  successMarkers: string[];
  note?: string;
  mustFollow: MonthlyPlannerMustFollow;
  preferences: MonthlyPlannerPreferences;
};

type MonthlyPlannerParametersInput = Partial<MonthlyPlannerParameters> & {
  objective?: string;
  ambition?: string;
  selectedRecommendation?: Partial<MonthlyPlannerSelectedRecommendation> & {
    source?: string;
    confidence?: string;
  };
  mustFollow?: Partial<MonthlyPlannerMustFollow>;
  preferences?: Partial<MonthlyPlannerPreferences>;
};

function todayMonthStart(today?: string) {
  const base = today || new Date().toISOString().slice(0, 10);
  return `${base.slice(0, 8)}01`;
}

function clampRestDaysPerWeek(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.max(0, Math.min(3, numeric));
}

function finiteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function coerceObjective(value: unknown): MonthlyPlannerObjective {
  switch (value) {
    case 'threshold_support':
    case 'race_specificity':
    case 'aerobic_support':
    case 'rebuild':
    case 'consistency':
    case 'taper':
    case 'repeatability':
      return value;
    default:
      return 'repeatability';
  }
}

function coerceAmbition(value: unknown): MonthlyPlannerAmbition {
  switch (value) {
    case 'conservative':
    case 'ambitious':
    case 'balanced':
      return value;
    default:
      return 'balanced';
  }
}

function coerceRecommendationSource(value: unknown): MonthlyPlannerRecommendationSource {
  switch (value) {
    case 'primary':
    case 'alternative':
    case 'manual':
      return value;
    default:
      return 'manual';
  }
}

export function coerceMonthlyPlannerParameters(input: MonthlyPlannerParametersInput, today?: string): MonthlyPlannerParameters {
  const objective = coerceObjective(input.objective);
  const recommendation = input.selectedRecommendation?.title
    ? {
        source: coerceRecommendationSource(input.selectedRecommendation.source),
        title: String(input.selectedRecommendation.title),
        objective,
        reason: input.selectedRecommendation.reason ? String(input.selectedRecommendation.reason) : undefined,
        confidence: input.selectedRecommendation.confidence === 'low' || input.selectedRecommendation.confidence === 'medium' || input.selectedRecommendation.confidence === 'high'
          ? input.selectedRecommendation.confidence
          : undefined,
      }
    : undefined;

  return {
    monthStart: typeof input.monthStart === 'string' && input.monthStart ? input.monthStart : todayMonthStart(today),
    sourceWindowDays: input.sourceWindowDays === 28 ? 28 : 42,
    ignoreSickWeek: input.ignoreSickWeek === true,
    ignoreVacationWeek: input.ignoreVacationWeek === true,
    excludeNonPrimarySport: input.excludeNonPrimarySport === true,
    objective,
    ambition: coerceAmbition(input.ambition),
    selectedRecommendation: recommendation,
    successMarkers: Array.isArray(input.successMarkers) ? input.successMarkers.map(String) : [],
    note: input.note ? String(input.note) : undefined,
    mustFollow: {
      unavailableDates: Array.isArray(input.mustFollow?.unavailableDates) ? input.mustFollow!.unavailableDates.map(String).filter(Boolean) : [],
      maxWeeklyHours: finiteNumber(input.mustFollow?.maxWeeklyHours),
      maxWeekdayMinutes: finiteNumber(input.mustFollow?.maxWeekdayMinutes),
      noDoubles: input.mustFollow?.noDoubles === true,
      noBackToBackHardDays: input.mustFollow?.noBackToBackHardDays === true,
      injuryNote: input.mustFollow?.injuryNote ? String(input.mustFollow.injuryNote) : undefined,
    },
    preferences: {
      longRideDay: input.preferences?.longRideDay ? String(input.preferences.longRideDay) : undefined,
      strengthDays: Array.isArray(input.preferences?.strengthDays) ? input.preferences!.strengthDays.map(String) : undefined,
      outdoorWeekends: typeof input.preferences?.outdoorWeekends === 'boolean' ? input.preferences.outdoorWeekends : undefined,
      twoKeySessions: typeof input.preferences?.twoKeySessions === 'boolean' ? input.preferences.twoKeySessions : undefined,
      restDay: input.preferences?.restDay ? String(input.preferences.restDay) : undefined,
      restDaysPerWeek: clampRestDaysPerWeek(input.preferences?.restDaysPerWeek),
      lighterWeekend: typeof input.preferences?.lighterWeekend === 'boolean' ? input.preferences.lighterWeekend : undefined,
    },
  };
}
