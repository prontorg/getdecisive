'use client';

import { useMemo, useState } from 'react';

import {
  applyManualObjectiveOverride,
  buildBuilderSubmitPayload,
  parseUnavailableDatesInput,
  selectAlternativeRecommendation,
  selectPrimaryRecommendation,
  type BuilderFormState,
  type RecommendationAlternative,
  type RecommendationPrimary,
  type RecommendationSource,
} from './training-plan-stateful-builder-state';

type ObjectiveOption = { value: string; label: string };
type RecommendationSelection = {
  source: RecommendationSource;
  title: string;
  objective: string;
  reason?: string;
  confidence?: string;
};

type BuilderDefaults = {
  objective: string;
  ambition: string;
  maxWeeklyHours: number;
  maxWeekdayMinutes: number;
  restDay: string;
  restDaysPerWeek: number;
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

export function TrainingPlanStatefulBuilderClient({
  objectiveOptions,
  recommendationPrimary,
  recommendationAlternatives,
  initialSelection,
  initialValues,
  successOptions,
}: {
  objectiveOptions: readonly ObjectiveOption[];
  recommendationPrimary: RecommendationPrimary;
  recommendationAlternatives: RecommendationAlternative[];
  initialSelection?: RecommendationSelection;
  initialValues: BuilderDefaults;
  successOptions: readonly string[];
}) {
  const initialObjective = initialSelection?.objective || initialValues.objective || recommendationPrimary.objective;
  const [selectedFocusObjective, setSelectedFocusObjective] = useState(initialObjective);
  const [selectedRecommendationSource, setSelectedRecommendationSource] = useState<RecommendationSource>(initialSelection?.source || 'manual');
  const [selectedRecommendationTitle, setSelectedRecommendationTitle] = useState(initialSelection?.title || objectiveOptions.find((item) => item.value === initialObjective)?.label || initialObjective);
  const [selectedRecommendationReason, setSelectedRecommendationReason] = useState(initialSelection?.reason || recommendationPrimary.explanation);
  const [selectedRecommendationConfidence, setSelectedRecommendationConfidence] = useState(initialSelection?.confidence || recommendationPrimary.confidence || '');
  const [ambition, setAmbition] = useState(initialValues.ambition);
  const [maxWeeklyHours, setMaxWeeklyHours] = useState(String(initialValues.maxWeeklyHours));
  const [maxWeekdayMinutes, setMaxWeekdayMinutes] = useState(String(initialValues.maxWeekdayMinutes));
  const [restDay, setRestDay] = useState(initialValues.restDay);
  const [restDaysPerWeek, setRestDaysPerWeek] = useState(String(initialValues.restDaysPerWeek));
  const [longRideDay, setLongRideDay] = useState(initialValues.longRideDay);
  const [unavailableDates, setUnavailableDates] = useState<string[]>(initialValues.unavailableDates);
  const [unavailableDatesInput, setUnavailableDatesInput] = useState(initialValues.unavailableDates.join('\n'));
  const [noDoubles, setNoDoubles] = useState(initialValues.noDoubles);
  const [noBackToBackHardDays, setNoBackToBackHardDays] = useState(initialValues.noBackToBackHardDays);
  const [useLast28DaysOnly, setUseLast28DaysOnly] = useState(initialValues.useLast28DaysOnly);
  const [ignoreSickWeek, setIgnoreSickWeek] = useState(initialValues.ignoreSickWeek);
  const [ignoreVacationWeek, setIgnoreVacationWeek] = useState(initialValues.ignoreVacationWeek);
  const [excludeNonPrimarySport, setExcludeNonPrimarySport] = useState(initialValues.excludeNonPrimarySport);
  const [note, setNote] = useState(initialValues.note);
  const [selectedSuccessMarkers, setSelectedSuccessMarkers] = useState<string[]>(initialValues.successMarkers);

  const builderState: BuilderFormState = {
    objective: selectedFocusObjective,
    recommendationSource: selectedRecommendationSource,
    recommendationTitle: selectedRecommendationTitle,
    recommendationReason: selectedRecommendationReason,
    recommendationConfidence: selectedRecommendationConfidence,
    ambition,
    maxWeeklyHours,
    maxWeekdayMinutes,
    restDay,
    restDaysPerWeek,
    longRideDay,
    unavailableDates,
    noDoubles,
    noBackToBackHardDays,
    useLast28DaysOnly,
    ignoreSickWeek,
    ignoreVacationWeek,
    excludeNonPrimarySport,
    successMarkers: selectedSuccessMarkers,
    note,
  };

  const submitPayload = buildBuilderSubmitPayload(builderState);

  const selectedSummary = useMemo(() => {
    if (selectedRecommendationSource === 'primary') return recommendationPrimary.title;
    const alt = recommendationAlternatives.find((item) => item.objective === selectedFocusObjective);
    return alt?.title || selectedRecommendationTitle;
  }, [recommendationAlternatives, recommendationPrimary.title, selectedFocusObjective, selectedRecommendationSource, selectedRecommendationTitle]);

  const primaryChipPressed = selectedFocusObjective === recommendationPrimary.objective ? 'true' : 'false';

  function altChipPressed(objective: string) {
    return selectedRecommendationSource === 'alternative' && selectedFocusObjective === objective ? 'true' : 'false';
  }

  function chooseRecommendation(selection: RecommendationSelection) {
    const nextState = selection.source === 'primary'
      ? selectPrimaryRecommendation(builderState, recommendationPrimary)
      : selection.source === 'alternative'
        ? selectAlternativeRecommendation(builderState, {
            title: selection.title,
            objective: selection.objective,
            reason: selection.reason || '',
          })
        : applyManualObjectiveOverride(builderState, selection.objective, selection.title);

    setSelectedFocusObjective(nextState.objective);
    setSelectedRecommendationSource(nextState.recommendationSource);
    setSelectedRecommendationTitle(nextState.recommendationTitle);
    setSelectedRecommendationReason(nextState.recommendationReason);
    setSelectedRecommendationConfidence(nextState.recommendationConfidence);
  }

  function toggleSuccessMarker(marker: string, checked: boolean) {
    setSelectedSuccessMarkers((current) => checked ? Array.from(new Set([...current, marker])) : current.filter((item) => item !== marker));
  }

  function updateUnavailableDates(value: string) {
    setUnavailableDatesInput(value);
    setUnavailableDates(parseUnavailableDatesInput(value));
  }

  return (
    <form action="/api/planner/month/draft" method="post" className="training-plan-stateful-builder-client">
      <input type="hidden" name="objective" value={submitPayload.objective} />
      <input type="hidden" name="selectedRecommendationSource" value={submitPayload.selectedRecommendationSource} />
      <input type="hidden" name="selectedRecommendationTitle" value={submitPayload.selectedRecommendationTitle} />
      <input type="hidden" name="selectedRecommendationReason" value={submitPayload.selectedRecommendationReason} />
      {submitPayload.selectedRecommendationConfidence ? <input type="hidden" name="selectedRecommendationConfidence" value={submitPayload.selectedRecommendationConfidence} /> : null}
      <input type="hidden" name="maxWeekdayMinutes" value={submitPayload.maxWeekdayMinutes} />
      {submitPayload.unavailableDates.map((date) => <input key={date} type="hidden" name="unavailableDates" value={date} />)}
      {submitPayload.useLast28DaysOnly ? <input type="hidden" name="useLast28DaysOnly" value="true" /> : null}
      {submitPayload.ignoreSickWeek ? <input type="hidden" name="ignoreSickWeek" value="true" /> : null}
      {submitPayload.ignoreVacationWeek ? <input type="hidden" name="ignoreVacationWeek" value="true" /> : null}
      {submitPayload.excludeNonPrimarySport ? <input type="hidden" name="excludeNonPrimarySport" value="true" /> : null}

      <div className="training-plan-builder-bar">
        <div className="training-plan-focus-row">
              <div className="training-plan-focus-row__label">
                <strong>Month direction</strong>
              </div>
<div className="training-plan-focus-chip-row">
            <button
              type="button"
              aria-pressed={primaryChipPressed}
              className={`training-plan-focus-chip training-plan-focus-chip-recommended ${primaryChipPressed === 'true' ? 'training-plan-focus-chip-selected' : ''}`}
              onClick={() => chooseRecommendation({
                source: 'primary',
                title: recommendationPrimary.title,
                objective: recommendationPrimary.objective,
                reason: recommendationPrimary.explanation,
                confidence: recommendationPrimary.confidence,
              })}
                >
                  {recommendationPrimary.title}
                </button>
{recommendationAlternatives.map((item) => (
              <button
                key={item.objective}
                type="button"
                aria-pressed={altChipPressed(item.objective)}
                className={`training-plan-focus-chip ${altChipPressed(item.objective) === 'true' ? 'training-plan-focus-chip-selected' : ''}`}
                onClick={() => chooseRecommendation({
                  source: 'alternative',
                  title: item.title,
                  objective: item.objective,
                  reason: item.reason,
                })}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="training-plan-builder-bar training-plan-builder-bar-compact">
        <input type="hidden" name="objectiveVisible" value={selectedFocusObjective} />
        <input type="hidden" name="longRideDay" value={longRideDay} />
        <label>
          <span>Max hours / week</span>
          <input name="maxWeeklyHours" type="number" min="4" max="20" step="0.5" value={maxWeeklyHours} onChange={(event) => setMaxWeeklyHours(event.target.value)} />
        </label>
        <label>
          <span>Rest day</span>
          <select name="restDay" value={restDay} onChange={(event) => setRestDay(event.target.value)}>
            {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day) => <option key={day} value={day}>{day}</option>)}
          </select>
        </label>
        <input type="hidden" name="restDaysPerWeek" value={restDaysPerWeek} />
        <button type="submit">Generate draft</button>

        <details className="training-plan-builder-advanced">
          <summary>More options</summary>
          <div className="training-plan-builder-advanced__body">
            <div className="training-plan-quick-notes">
              <div className="training-plan-quick-note training-plan-quick-note-emphasis">
                <strong>Plan snapshot</strong>
                <p>{selectedSummary} • {maxWeeklyHours} h • {restDay} rest</p>
              </div>
            </div>
            <p className="training-plan-workspace-calendar-copy">Advanced planning controls only when you need them.</p>
            <div className="training-plan-direction-grid">
              <label>
                <span>Ambition</span>
                <select name="ambition" value={ambition} onChange={(event) => setAmbition(event.target.value)}>
                  <option value="conservative">Conservative</option>
                  <option value="balanced">Balanced</option>
                  <option value="ambitious">Ambitious</option>
                </select>
              </label>
              <label>
                <span>Rest days / week</span>
                <select name="restDaysPerWeek" value={restDaysPerWeek} onChange={(event) => setRestDaysPerWeek(event.target.value)}>
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </label>
              <label>
                <span>Long ride</span>
                <select name="longRideDay" value={longRideDay} onChange={(event) => setLongRideDay(event.target.value)}>
                  {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day) => <option key={day} value={day}>{day}</option>)}
                </select>
              </label>
              <label>
                <span>Weekday cap</span>
                <input name="maxWeekdayMinutes" type="number" min="45" max="240" step="5" value={maxWeekdayMinutes} onChange={(event) => setMaxWeekdayMinutes(event.target.value)} />
              </label>
              <label>
                <span>Unavailable dates</span>
                <textarea
                  name="unavailableDatesEditor"
                  rows={3}
                  value={unavailableDatesInput}
                  onChange={(event) => updateUnavailableDates(event.target.value)}
                  placeholder="YYYY-MM-DD"
                />
              </label>
            </div>
            <div className="training-plan-inline-flags">
              <label className="training-plan-compact-check"><input name="noDoubles" type="checkbox" checked={noDoubles} onChange={(event) => setNoDoubles(event.target.checked)} /> <span>No doubles</span></label>
              <label className="training-plan-compact-check"><input name="noBackToBackHardDays" type="checkbox" checked={noBackToBackHardDays} onChange={(event) => setNoBackToBackHardDays(event.target.checked)} /> <span>Hard spacing</span></label>
            </div>
            <fieldset className="training-plan-success-fieldset">
              <legend>Data filters</legend>
              <div className="chip-row">
                <label className="chip">
                  <input type="checkbox" name="useLast28DaysOnly" checked={useLast28DaysOnly} onChange={(event) => setUseLast28DaysOnly(event.target.checked)} /> Last 28 days only
                </label>
                <label className="chip">
                  <input type="checkbox" name="ignoreSickWeek" checked={ignoreSickWeek} onChange={(event) => setIgnoreSickWeek(event.target.checked)} /> Ignore sick week
                </label>
                <label className="chip">
                  <input type="checkbox" name="ignoreVacationWeek" checked={ignoreVacationWeek} onChange={(event) => setIgnoreVacationWeek(event.target.checked)} /> Ignore vacation week
                </label>
                <label className="chip">
                  <input type="checkbox" name="excludeNonPrimarySport" checked={excludeNonPrimarySport} onChange={(event) => setExcludeNonPrimarySport(event.target.checked)} /> Exclude non-primary sport
                </label>
              </div>
            </fieldset>
            <fieldset className="training-plan-success-fieldset">
              <legend>Success markers</legend>
              <div className="chip-row">
                {successOptions.map((item) => (
                  <label key={item} className="chip">
                    <input type="checkbox" name="successMarkers" value={item} checked={selectedSuccessMarkers.includes(item)} onChange={(event) => toggleSuccessMarker(item, event.target.checked)} /> {item}
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              <span>Note</span>
              <textarea name="note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
          </div>
        </details>
      </div>
    </form>
  );
}
