import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyManualObjectiveOverride,
  buildBuilderSubmitPayload,
  selectAlternativeRecommendation,
  selectPrimaryRecommendation,
  type BuilderFormState,
  type RecommendationAlternative,
  type RecommendationPrimary,
} from '../app/app/_components/training-plan-stateful-builder-state';

const recommendationPrimary: RecommendationPrimary = {
  title: 'Build repeatability for track racing',
  objective: 'repeatability',
  confidence: 'high',
  explanation: 'Best fit for current freshness and race demands.',
};

const recommendationAlternative: RecommendationAlternative = {
  title: 'Raise threshold support',
  objective: 'threshold_support',
  reason: 'Use this if you want the month anchored more clearly around threshold support.',
};

function baseState(): BuilderFormState {
  return {
    objective: 'repeatability',
    recommendationSource: 'primary',
    recommendationTitle: recommendationPrimary.title,
    recommendationReason: recommendationPrimary.explanation,
    recommendationConfidence: recommendationPrimary.confidence,
    ambition: 'balanced',
    maxWeeklyHours: '10.5',
    restDay: 'Saturday',
    restDaysPerWeek: '1',
    longRideDay: 'Sunday',
    noDoubles: true,
    noBackToBackHardDays: true,
    successMarkers: ['Complete 4 consistent weeks'],
    note: 'Keep Tuesday open for track access',
  };
}

test('selecting an alternative chip keeps advanced edits while updating the final submit payload', () => {
  const updated = selectAlternativeRecommendation(baseState(), recommendationAlternative);
  const payload = buildBuilderSubmitPayload(updated);

  assert.equal(updated.objective, 'threshold_support');
  assert.equal(updated.recommendationSource, 'alternative');
  assert.equal(updated.maxWeeklyHours, '10.5');
  assert.equal(updated.restDay, 'Saturday');
  assert.equal(updated.note, 'Keep Tuesday open for track access');
  assert.deepEqual(updated.successMarkers, ['Complete 4 consistent weeks']);
  assert.equal(payload.objective, 'threshold_support');
  assert.equal(payload.selectedRecommendationSource, 'alternative');
  assert.equal(payload.selectedRecommendationTitle, 'Raise threshold support');
});

test('manual month focus override wins final submit objective while keeping advanced edits intact', () => {
  const alternativeSelected = selectAlternativeRecommendation(baseState(), recommendationAlternative);
  const manual = applyManualObjectiveOverride(alternativeSelected, 'race_specificity', 'Increase race-like specificity');
  const payload = buildBuilderSubmitPayload(manual);

  assert.equal(manual.objective, 'race_specificity');
  assert.equal(manual.recommendationSource, 'manual');
  assert.equal(manual.recommendationTitle, 'Increase race-like specificity');
  assert.equal(manual.recommendationConfidence, '');
  assert.equal(manual.maxWeeklyHours, '10.5');
  assert.equal(manual.note, 'Keep Tuesday open for track access');
  assert.equal(payload.objective, 'race_specificity');
  assert.equal(payload.selectedRecommendationSource, 'manual');
  assert.equal(payload.selectedRecommendationTitle, 'Increase race-like specificity');
});

test('reselecting the primary chip restores primary recommendation metadata after a manual override', () => {
  const manual = applyManualObjectiveOverride(baseState(), 'race_specificity', 'Increase race-like specificity');
  const primarySelected = selectPrimaryRecommendation(manual, recommendationPrimary);
  const payload = buildBuilderSubmitPayload(primarySelected);

  assert.equal(primarySelected.objective, 'repeatability');
  assert.equal(primarySelected.recommendationSource, 'primary');
  assert.equal(primarySelected.recommendationTitle, 'Build repeatability for track racing');
  assert.equal(primarySelected.recommendationConfidence, 'high');
  assert.equal(primarySelected.note, 'Keep Tuesday open for track access');
  assert.equal(payload.objective, 'repeatability');
  assert.equal(payload.selectedRecommendationSource, 'primary');
  assert.equal(payload.selectedRecommendationConfidence, 'high');
});
