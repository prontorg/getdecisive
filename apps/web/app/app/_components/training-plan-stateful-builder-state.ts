export type RecommendationSource = 'primary' | 'alternative' | 'manual';

const PLANNER_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type RecommendationPrimary = {
  title: string;
  objective: string;
  confidence: string;
  explanation: string;
};

export type RecommendationAlternative = {
  title: string;
  objective: string;
  reason: string;
};

export type BuilderFormState = {
  objective: string;
  recommendationSource: RecommendationSource;
  recommendationTitle: string;
  recommendationReason: string;
  recommendationConfidence: string;
  ambition: string;
  maxWeeklyHours: string;
  maxWeekdayMinutes: string;
  restDay: string;
  restDaysPerWeek: string;
  longRideDay: string;
  unavailableDates: string[];
  noDoubles: boolean;
  noBackToBackHardDays: boolean;
  useLast28DaysOnly: boolean;
  ignoreSickWeek: boolean;
  ignoreVacationWeek: boolean;
  excludeNonPrimarySport: boolean;
  successMarkers: string[];
  note: string;
};

export function selectPrimaryRecommendation(
  state: BuilderFormState,
  recommendationPrimary: RecommendationPrimary,
): BuilderFormState {
  return {
    ...state,
    objective: recommendationPrimary.objective,
    recommendationSource: 'primary',
    recommendationTitle: recommendationPrimary.title,
    recommendationReason: recommendationPrimary.explanation,
    recommendationConfidence: recommendationPrimary.confidence,
  };
}

export function selectAlternativeRecommendation(
  state: BuilderFormState,
  recommendationAlternative: RecommendationAlternative,
): BuilderFormState {
  return {
    ...state,
    objective: recommendationAlternative.objective,
    recommendationSource: 'alternative',
    recommendationTitle: recommendationAlternative.title,
    recommendationReason: recommendationAlternative.reason,
    recommendationConfidence: '',
  };
}

export function applyManualObjectiveOverride(
  state: BuilderFormState,
  objective: string,
  objectiveLabel: string,
): BuilderFormState {
  return {
    ...state,
    objective,
    recommendationSource: 'manual',
    recommendationTitle: objectiveLabel,
    recommendationReason: 'Builder inputs are saved, but this direction was not selected from the recommendation chips.',
    recommendationConfidence: '',
  };
}

export function parseUnavailableDatesInput(value: string) {
  const uniqueDates = new Set<string>();
  for (const token of value.split(/[\s,]+/)) {
    const trimmed = token.trim();
    if (!PLANNER_DATE_REGEX.test(trimmed)) continue;
    uniqueDates.add(trimmed);
  }
  return Array.from(uniqueDates);
}

export function areBuilderInputsDirty(initialState: BuilderFormState, currentState: BuilderFormState) {
  const initialPayload = buildBuilderSubmitPayload(initialState);
  const currentPayload = buildBuilderSubmitPayload(currentState);
  return JSON.stringify(initialPayload) !== JSON.stringify(currentPayload);
}

export function buildBuilderSubmitPayload(state: BuilderFormState) {
  return {
    objective: state.objective,
    selectedRecommendationSource: state.recommendationSource,
    selectedRecommendationTitle: state.recommendationTitle,
    selectedRecommendationReason: state.recommendationReason,
    selectedRecommendationConfidence: state.recommendationConfidence,
    ambition: state.ambition,
    maxWeeklyHours: state.maxWeeklyHours,
    maxWeekdayMinutes: state.maxWeekdayMinutes,
    restDay: state.restDay,
    restDaysPerWeek: state.restDaysPerWeek,
    longRideDay: state.longRideDay,
    unavailableDates: state.unavailableDates,
    useLast28DaysOnly: state.useLast28DaysOnly,
    ignoreSickWeek: state.ignoreSickWeek,
    ignoreVacationWeek: state.ignoreVacationWeek,
    excludeNonPrimarySport: state.excludeNonPrimarySport,
    note: state.note,
    successMarkers: state.successMarkers,
    noDoubles: state.noDoubles,
    noBackToBackHardDays: state.noBackToBackHardDays,
  };
}
