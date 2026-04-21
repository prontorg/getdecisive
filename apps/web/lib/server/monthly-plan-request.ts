import type { MonthlyPlanInput } from './planner-customization';

type ParsedMonthlyPlanBody = FormData | Record<string, any>;

function pickValue(parsed: ParsedMonthlyPlanBody, key: string) {
  return parsed instanceof FormData ? parsed.get(key) : parsed[key];
}

function pickAllValues(parsed: ParsedMonthlyPlanBody, key: string) {
  return parsed instanceof FormData ? parsed.getAll(key) : Array.isArray(parsed[key]) ? parsed[key] : [];
}

function pickCheckbox(parsed: ParsedMonthlyPlanBody, key: string) {
  const value = pickValue(parsed, key);
  if (parsed instanceof FormData) return value !== null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === 'on' || value === '1';
  if (typeof value === 'number') return value !== 0;
  return false;
}

export function normalizeMonthlyPlanRequestBody(
  parsed: ParsedMonthlyPlanBody,
  today?: string,
): Omit<MonthlyPlanInput, 'id' | 'createdAt' | 'updatedAt'> {
  const objective = String(pickValue(parsed, 'objective') || 'repeatability') as MonthlyPlanInput['objective'];
  const recommendationTitle = pickValue(parsed, 'selectedRecommendationTitle') ? String(pickValue(parsed, 'selectedRecommendationTitle')) : undefined;
  const recommendationSource = pickValue(parsed, 'selectedRecommendationSource') ? String(pickValue(parsed, 'selectedRecommendationSource')) : undefined;
  const recommendationReason = pickValue(parsed, 'selectedRecommendationReason') ? String(pickValue(parsed, 'selectedRecommendationReason')) : undefined;
  const recommendationConfidence = pickValue(parsed, 'selectedRecommendationConfidence') ? String(pickValue(parsed, 'selectedRecommendationConfidence')) : undefined;
  return {
    monthStart: String(pickValue(parsed, 'monthStart') || (today || new Date().toISOString().slice(0, 10)).slice(0, 8) + '01'),
    sourceWindowDays: pickCheckbox(parsed, 'useLast28DaysOnly') ? 28 : 42,
    ignoreSickWeek: pickCheckbox(parsed, 'ignoreSickWeek'),
    ignoreVacationWeek: pickCheckbox(parsed, 'ignoreVacationWeek'),
    excludeNonPrimarySport: pickCheckbox(parsed, 'excludeNonPrimarySport'),
    objective,
    ambition: String(pickValue(parsed, 'ambition') || 'balanced') as MonthlyPlanInput['ambition'],
    selectedRecommendation: recommendationTitle
      ? {
          source: (recommendationSource === 'primary' || recommendationSource === 'alternative' || recommendationSource === 'manual' ? recommendationSource : 'manual') as 'primary' | 'alternative' | 'manual',
          title: recommendationTitle,
          objective,
          reason: recommendationReason,
          confidence: recommendationConfidence === 'low' || recommendationConfidence === 'medium' || recommendationConfidence === 'high'
            ? recommendationConfidence
            : undefined,
        }
      : undefined,
    successMarkers: pickAllValues(parsed, 'successMarkers').map(String),
    note: pickValue(parsed, 'note') ? String(pickValue(parsed, 'note')) : undefined,
    mustFollow: {
      unavailableDates: [],
      maxWeeklyHours: Number.isFinite(Number(pickValue(parsed, 'maxWeeklyHours'))) ? Number(pickValue(parsed, 'maxWeeklyHours')) : undefined,
      maxWeekdayMinutes: Number.isFinite(Number(pickValue(parsed, 'maxWeekdayMinutes'))) ? Number(pickValue(parsed, 'maxWeekdayMinutes')) : undefined,
      noDoubles: pickCheckbox(parsed, 'noDoubles'),
      noBackToBackHardDays: pickCheckbox(parsed, 'noBackToBackHardDays'),
      injuryNote: pickValue(parsed, 'injuryNote') ? String(pickValue(parsed, 'injuryNote')) : undefined,
    },
    preferences: {
      longRideDay: pickValue(parsed, 'longRideDay') ? String(pickValue(parsed, 'longRideDay')) : undefined,
      strengthDays: undefined,
      outdoorWeekends: pickValue(parsed, 'outdoorWeekends') == null ? undefined : pickCheckbox(parsed, 'outdoorWeekends'),
      twoKeySessions: pickValue(parsed, 'twoKeySessions') == null ? undefined : pickCheckbox(parsed, 'twoKeySessions'),
      restDay: pickValue(parsed, 'restDay') ? String(pickValue(parsed, 'restDay')) : undefined,
      restDaysPerWeek: Number.isFinite(Number(pickValue(parsed, 'restDaysPerWeek'))) ? Math.max(0, Math.min(3, Number(pickValue(parsed, 'restDaysPerWeek')))) : undefined,
      lighterWeekend: pickValue(parsed, 'lighterWeekend') == null ? undefined : pickCheckbox(parsed, 'lighterWeekend'),
    },
  };
}
