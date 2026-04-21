export type RecommendationSource = 'primary' | 'alternative' | 'manual';

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
  restDay: string;
  restDaysPerWeek: string;
  longRideDay: string;
  noDoubles: boolean;
  noBackToBackHardDays: boolean;
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

export function buildBuilderSubmitPayload(state: BuilderFormState) {
  return {
    objective: state.objective,
    selectedRecommendationSource: state.recommendationSource,
    selectedRecommendationTitle: state.recommendationTitle,
    selectedRecommendationReason: state.recommendationReason,
    selectedRecommendationConfidence: state.recommendationConfidence,
    ambition: state.ambition,
    maxWeeklyHours: state.maxWeeklyHours,
    restDay: state.restDay,
    restDaysPerWeek: state.restDaysPerWeek,
    longRideDay: state.longRideDay,
    note: state.note,
    successMarkers: state.successMarkers,
    noDoubles: state.noDoubles,
    noBackToBackHardDays: state.noBackToBackHardDays,
  };
}
