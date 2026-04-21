import { unstable_cache } from 'next/cache';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

import { appRoutes } from '../routes';
import { getDerivedOnboardingStatusRecord, getLatestIntervalsConnectionRecord, getPlatformState } from './auth-store';
import type { LiveRow, LiveState } from './live-state';
import {
  completeIntervalsSyncJob,
  deriveOnboardingStatus,
  getLatestIntervalsConnection,
  getOnboardingRun,
  getUserById,
  type PlatformState,
  type UserRecord,
} from './platform-state';
import { getLatestSnapshotForUser, getLatestSyncJobForUser } from './sync-store';
import { ensureCurrentPlanningContext } from './planning/planning-store';
import type { DailyDecision, PlanningCycle } from './planning/types';

const execFileAsync = promisify(execFile);
const HERMES_HOME = process.env.HERMES_HOME || '/root/.hermes/profiles/profdecisive';
const DASHBOARD_SCRIPT = `${HERMES_HOME}/scripts/intervals_dashboard.py`;
const COACH_SCRIPT = `${HERMES_HOME}/scripts/intervals_coach.py`;
const LIVE_INTERVALS_CACHE_SECONDS = 30;

export type AuthenticatedPlannerContext = {
  state: PlatformState;
  user: UserRecord;
  onboardingState: string;
};


export type MonthlyPlannerComparePayload = {
  recentWindow: { label: 'Recent 4 weeks'; totalHours: number; totalLoad: number; totalSessions: number };
  draftWindow: { label: 'Planned next 4 weeks'; totalHours: number; totalLoad: number; totalSessions: number };
  categoryComparison: Array<{
    category: 'repeatability' | 'threshold_support' | 'race_like' | 'endurance' | 'recovery' | 'rest';
    recentSessions: number;
    plannedSessions: number;
    deltaSessions: number;
    recentHours: number;
    plannedHours: number;
  }>;
  freshnessWarnings: string[];
  summary: string;
};

export type PlannerDayPayload = {
  date: string;
  plannedToday: string;
  plannedTomorrow: string;
  shouldActuallyHappenToday: string;
  why: string;
  nextToProtect: string;
  adaptationState: 'none' | 'watch' | 'sick_readjustment';
  planChangeSummary: string;
  intervalsPlanWriteState: 'disabled_read_only';
  ctl: number;
  atl: number;
  form: number;
  goalRaceDate?: string;
  latestWorkoutSummary?: string;
};

export type PowerProfilePayload = {
  strengths: string[];
  weaknesses: string[];
  powerCurveHighlights: Array<{ label: string; value: string; interpretation: string }>;
  trendDirectionBySystem: Array<{ system: string; trend: 'up' | 'steady' | 'needs_attention'; note: string }>;
  goalAlignmentSummary: string[];
  recommendedEmphasisChanges: string[];
  analysisViewRoute: string;
  latestWorkoutDay: string[];
  monthZoneFocus: Array<{ zone: string; hours: string }>;
};

export type GoalPayload = {
  activeGoals: Array<{ type: string; title: string; targetDate?: string; status: string }>;
  latestGoalChanges: Array<{ title: string; reason: string; effect: string }>;
  currentPlanFitSummary: string;
  goalHistory: Array<{ title: string; priority: string; updatedAt: string; notes?: string }>;
};

export type AdaptationPayload = {
  adaptationTrigger: string;
  sessionsChanged: string[];
  blockChangeSummary: string;
  returnToFullTrainingCriteria: string[];
  userFacingExplanation: string;
  confidence: 'medium';
  manualReviewRecommended: boolean;
  recentCheckins: Array<{ date: string; status: string; action: string; illness: boolean; note?: string }>;
};

export type PlannerWeekPayload = {
  weekIntent: string;
  keySessionsPlanned: string[];
  keySessionsCompleted: string[];
  missingSystems: string[];
  fatigueTrend: string;
  riskFlags: string[];
};

export type PlannerBlockPayload = {
  activeBlock: string;
  currentWeekWithinBlock: number;
  mainEmphasis: string;
  sessionsCompletedAgainstIntendedPattern: string;
  blockState: string;
  intervalsPlanWriteState: 'disabled_read_only';
};

export type MonthlyPlannerContextPayload = {
  goalEvent: { title: string; date?: string; currentDirection?: string };
  currentState: { ctl: number; atl: number; form: number; freshnessSummary: string; phase: string };
  recentHistory: { loadSummary: string; keySessions: string[]; repeatablePattern: string; caution: string };
  statusQuo: {
    recentFocus: string[];
    eventProximity: string;
    mainImplication: string;
  };
  availability: { summary: string[] };
  guardrails: { summary: string[] };
  toggles: {
    ignoreSickWeek: boolean;
    ignoreVacationWeek: boolean;
    useLast28DaysOnly: boolean;
    excludeNonPrimarySport: boolean;
  };
};

export type MonthlyPlannerDraftPayload = {
  monthStart: string;
  objective: string;
  ambition: string;
  assumptions: {
    goalEvent?: string;
    goalDate?: string;
    ctl: number;
    atl: number;
    form: number;
    recentSummary: string[];
    availabilitySummary: string[];
    guardrailSummary: string[];
  };
  weeks: Array<{
    weekIndex: 1 | 2 | 3 | 4;
    label: string;
    intent: string;
    weekTypeLabel?: string;
    targetHours: number;
    targetLoad: number;
    availableHours?: number;
    eventHours?: number;
    longSessionDay?: string;
    completedThisWeek?: Array<{
      date: string;
      label: string;
      intervalLabel?: string;
      category: 'recovery' | 'endurance' | 'threshold_support' | 'repeatability' | 'race_like' | 'rest';
      durationMinutes?: number;
      targetLoad?: number;
      status: string;
      locked: boolean;
    }>;
    rationale: {
      carriedForward: string;
      protected: string;
      mainAim: string;
    };
    workouts: Array<{
      date: string;
      label: string;
      intervalLabel?: string;
      category: 'recovery' | 'endurance' | 'threshold_support' | 'repeatability' | 'race_like' | 'rest';
      durationMinutes?: number;
      targetLoad?: number;
      locked: boolean;
    }>;
  }>;
};

export type WeeklyDecisionPayload = {
  focus: 'race_specificity' | 'threshold_support' | 'repeatability' | 'aerobic_support' | 'unload';
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
  riskFlags: string[];
  remainingWeekHours: number;
  remainingQualityBudget: number;
};

export type CurrentWeekReplanPayload = {
  liveWindowLabel: string;
  draftBridgeLabel: string;
  plannedSoFar: string[];
  completedSoFar: string[];
  missedSessions: string[];
  remainingDays: string[];
  recommendedNextKeyDay: string;
  recommendedFocus: WeeklyDecisionPayload['focus'];
  recommendationText: string;
  selectedDirectionSummary?: string;
  remainingWeekHours: number;
  remainingQualityBudget: number;
};

export type PlanningRecommendationPayload = {
  primary: {
    title: string;
    objective: string;
    confidence: 'low' | 'medium' | 'high';
    explanation: string;
  };
  alternatives: Array<{
    title: string;
    objective: string;
    reason: string;
  }>;
  rationaleBullets: string[];
  riskFlags: string[];
  recommendedConstraints: string[];
};

export type TrainingNeedsSummary = {
  freshnessState: 'blocked' | 'constrained' | 'usable' | 'fresh';
  eventPressure: 'far' | 'medium' | 'near' | 'taper';
  primaryLimiter: 'repeatability' | 'threshold_support' | 'race_specificity' | 'aerobic_durability';
  protectedStrengths: Array<'repeatability' | 'threshold_support' | 'race_specificity' | 'aerobic_durability'>;
  systemStatus: {
    repeatability: 'needs_focus' | 'developing' | 'good';
    threshold_support: 'needs_focus' | 'developing' | 'good';
    race_specificity: 'needs_focus' | 'developing' | 'good';
    aerobic_durability: 'needs_focus' | 'developing' | 'good';
  };
  counts: {
    repeatability: number;
    threshold_support: number;
    race_like: number;
    endurance: number;
  };
  recentWeeklyHours: number;
};

export type BlockDecisionSummary = {
  monthObjective: 'repeatability' | 'threshold_support' | 'race_specificity' | 'aerobic_support' | 'rebuild' | 'consistency' | 'taper';
  primaryNeed: TrainingNeedsSummary['primaryLimiter'];
  weekDecisions: Array<{
    weekIndex: 1 | 2 | 3 | 4;
    focus: 'threshold_support' | 'repeatability' | 'race_specificity' | 'freshen';
  }>;
};

export async function getAuthenticatedPlannerContext(userId: string): Promise<AuthenticatedPlannerContext | null> {
  const state = await getPlatformState();
  const onboarding = await getDerivedOnboardingStatusRecord(userId) || deriveOnboardingStatus(state, userId) || getOnboardingRun(state, userId);
  const user = getUserById(state, userId);

  if (!user || !onboarding || onboarding.state !== 'ready') {
    return null;
  }

  return {
    state,
    user,
    onboardingState: onboarding.state,
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}m`;
}

function planLabel(plan?: string): string {
  const text = (plan || '').trim();
  if (!text || text === 'Z2 endurance') return 'Support endurance';
  const lower = text.toLowerCase();
  if (['rest', 'rest day', 'off', 'day off'].includes(lower)) return 'Rest day';
  if (['recovery', 'easy / recovery ride', 'easy / recovery run'].includes(lower)) return 'Recovery';
  return text;
}

function latestWorkoutLine(row: LiveRow): string {
  const label = row.summary?.short_label || row.session_type || row.name || 'Workout';
  const load = row.training_load ? `Load ${Math.round(row.training_load)}` : null;
  const duration = row.duration_s ? formatDuration(row.duration_s) : null;
  return [label, load, duration].filter(Boolean).join(' • ');
}

async function runPythonJson(code: string): Promise<any | null> {
  try {
    const { stdout } = await execFileAsync('python3', ['-c', code], { maxBuffer: 1024 * 1024 * 5 });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

const getLiveIntervalsStateCached = unstable_cache(
  async (): Promise<LiveState | null> => {
    const py = `
import importlib.util, json
from pathlib import Path

dashboard_path = Path(${JSON.stringify(DASHBOARD_SCRIPT)})
coach_path = Path(${JSON.stringify(COACH_SCRIPT)})

spec = importlib.util.spec_from_file_location('intervals_dashboard', dashboard_path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
state = mod.fetch_live_state()
coach_spec = importlib.util.spec_from_file_location('intervals_coach', coach_path)
coach = importlib.util.module_from_spec(coach_spec)
coach_spec.loader.exec_module(coach)
cfg = coach.load_config()
client = coach.IntervalsClient(cfg)
for row in state.get('recent_rows', [])[:10]:
    try:
        detail = client.activity(row['activity_id'])
        row['weighted_avg_watts'] = detail.get('icu_weighted_avg_watts')
        row['average_watts'] = detail.get('icu_average_watts')
        row['average_heartrate'] = detail.get('average_heartrate')
        row['max_heartrate'] = detail.get('max_heartrate')
        row['zone_times'] = {z.get('id'): int(z.get('secs') or 0) for z in (detail.get('icu_zone_times') or []) if z.get('id')}
    except Exception:
        row['zone_times'] = {}
state['athlete_id'] = getattr(cfg, 'athlete_id', None)
state['working_threshold_w'] = getattr(cfg, 'working_threshold_w', None)
state['season_focus'] = getattr(cfg, 'season_focus', None)
state['season_phase'] = getattr(cfg, 'season_phase', None)
print(json.dumps(state, ensure_ascii=False, default=str))
`;
    return await runPythonJson(py);
  },
  ['planner-live-intervals-state'],
  { revalidate: LIVE_INTERVALS_CACHE_SECONDS },
);

export async function getLiveIntervalsState(): Promise<LiveState | null> {
  return getLiveIntervalsStateCached();
}

export function authorizeLiveIntervalsState(context: AuthenticatedPlannerContext, live?: LiveState | null): LiveState | null {
  if (!live?.athlete_id) return null;
  const connection = getLatestIntervalsConnection(context.state, context.user.id);
  if (!connection || connection.syncStatus !== 'ready') return null;
  return connection.externalAthleteId === live.athlete_id ? live : null;
}

async function getStoredLiveState(context: AuthenticatedPlannerContext): Promise<LiveState | null> {
  const connection = await getLatestIntervalsConnectionRecord(context.user.id) || getLatestIntervalsConnection(context.state, context.user.id);
  if (!connection) return null;
  const snapshot = await getLatestSnapshotForUser(context.user.id, connection.id, context.state.intervalsSnapshots);
  if (!snapshot) return null;
  return authorizeLiveIntervalsState(context, snapshot.liveState);
}

export async function resolveAuthorizedLiveState(context: AuthenticatedPlannerContext, sharedLive?: LiveState | null): Promise<LiveState | null> {
  return await getStoredLiveState(context) || authorizeLiveIntervalsState(context, sharedLive);
}

export async function hydrateUserSnapshotFromSharedLive(
  state: PlatformState,
  userId: string,
  sharedLive?: LiveState | null,
): Promise<boolean> {
  const syncJob = await getLatestSyncJobForUser(userId, state.syncJobs);
  const connection = syncJob ? state.intervalsConnections.find((item) => item.id === syncJob.connectionId && item.userId === userId) || null : null;
  if (!connection || !syncJob || syncJob.status === 'completed') return false;
  if (await getLatestSnapshotForUser(userId, connection.id, state.intervalsSnapshots)) return false;

  const live = sharedLive ?? await getLiveIntervalsState();
  if (!live?.athlete_id || live.athlete_id !== connection.externalAthleteId) return false;

  completeIntervalsSyncJob(state, syncJob.id, live);
  return true;
}

export async function getAuthorizedPlannerLiveContext(userId: string): Promise<{ context: AuthenticatedPlannerContext; live: LiveState | null } | null> {
  const context = await getAuthenticatedPlannerContext(userId);
  if (!context) return null;
  const live = await resolveAuthorizedLiveState(context, await getLiveIntervalsState());
  return { context, live };
}

export type PlanningSurfaceSummary = {
  weekIntention: string;
  plannedToday: string;
  actualToday: string;
  plannedTomorrow: string;
  likelyTomorrow: string;
  reason: string;
  confidence: DailyDecision['confidence'] | null;
  nextKeyDay?: string;
  risks: string[];
};

export async function getActivePlanningContext(userId: string): Promise<{ cycle: PlanningCycle | null; todayDecision: DailyDecision | null; summary: PlanningSurfaceSummary | null }> {
  const { cycle, decision } = await ensureCurrentPlanningContext(userId);
  return {
    cycle,
    todayDecision: decision,
    summary: cycle && decision ? {
      weekIntention: `${cycle.primaryFocus} • ${cycle.phaseType}`,
      plannedToday: decision.plannedForToday,
      actualToday: decision.actualRecommendationForToday,
      plannedTomorrow: decision.plannedForTomorrow,
      likelyTomorrow: decision.likelyTomorrowAfterToday,
      reason: decision.reasonSummary,
      confidence: decision.confidence,
      nextKeyDay: decision.recommendedNextKeyDay,
      risks: decision.risks,
    } : null,
  };
}

function recentSessionCounts(rows: LiveRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.session_type || 'Other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function zoneSeconds(row: LiveRow, ...zones: string[]) {
  return zones.reduce((acc, zone) => acc + Number(row.zone_times?.[zone] || 0), 0);
}

function classifyRecentRow(row: LiveRow): 'repeatability' | 'threshold_support' | 'race_like' | 'endurance' | 'recovery' | 'rest' {
  const sessionType = (row.session_type || '').toLowerCase();
  const label = `${row.summary?.short_label || ''} ${row.name || ''}`.toLowerCase();
  const duration = Number(row.duration_s || 0);
  const load = Number(row.training_load || 0);
  const np = Number(row.weighted_avg_watts || row.average_watts || 0);
  const z2 = zoneSeconds(row, 'Z2');
  const z4 = zoneSeconds(row, 'Z4', 'SS');
  const z5 = zoneSeconds(row, 'Z5', 'Z6', 'Z7');

  if (sessionType.includes('rest')) return 'rest';
  if (sessionType.includes('recovery')) return 'recovery';
  if (sessionType.includes('repeatability') || sessionType.includes('broken vo2')) return 'repeatability';
  if (sessionType.includes('threshold') || sessionType.includes('race-support')) return 'threshold_support';
  if (sessionType.includes('race-like') || sessionType.includes('stochastic') || sessionType.includes('race')) return 'race_like';

  if (/30\/?15|40\/?20|vo2|max aerobic|anaerobic|microburst|repeat/i.test(label) || z5 >= 10 * 60) return 'repeatability';
  if (/threshold|sweet ?spot|tempo|over.?under|2x15|3x12|3x15/i.test(label) || z4 >= 20 * 60 || (np >= 330 && load >= 110)) return 'threshold_support';
  if (/points|scratch|race|stochastic|attacks|sprint/i.test(label) || (z5 >= 6 * 60 && load >= 100)) return 'race_like';
  if (duration <= 75 * 60 && load <= 40) return 'recovery';
  if (z2 >= 90 * 60 || duration >= 2.5 * 3600 || load >= 80) return 'endurance';
  return 'endurance';
}

export function buildTrainingNeedsSummary(
  live: LiveState | null | undefined,
  input?: {
    objective?: string;
    currentDirection?: string;
    mustFollow?: { maxWeeklyHours?: number };
  },
): TrainingNeedsSummary {
  const rows = live?.recent_rows || [];
  const counts = {
    repeatability: rows.filter((row) => classifyRecentRow(row) === 'repeatability').length,
    threshold_support: rows.filter((row) => classifyRecentRow(row) === 'threshold_support').length,
    race_like: rows.filter((row) => classifyRecentRow(row) === 'race_like').length,
    endurance: rows.filter((row) => classifyRecentRow(row) === 'endurance').length,
  };
  const recentHours = rows.reduce((acc, row) => acc + Number(row.duration_s || 0), 0) / 3600;
  const recentWeeklyHours = rows.length ? recentHours / Math.min(4, Math.max(1, Math.ceil(rows.length / 3))) : Number(input?.mustFollow?.maxWeeklyHours || 8);
  const form = Number(live?.wellness?.ctl || 0) - Number(live?.wellness?.atl || 0);
  const freshnessState = form <= -18 ? 'blocked' : form <= -12 ? 'constrained' : form >= 4 ? 'fresh' : 'usable';
  const today = live?.today || todayIso();
  const goalDate = live?.goal_race_date ? new Date(`${live.goal_race_date}T00:00:00Z`) : null;
  const todayDate = new Date(`${today}T00:00:00Z`);
  const daysToGoal = goalDate ? Math.round((goalDate.getTime() - todayDate.getTime()) / 86400000) : 999;
  const eventPressure = daysToGoal <= 14 ? 'taper' : daysToGoal <= 35 ? 'near' : daysToGoal <= 70 ? 'medium' : 'far';
  const systemStatus: TrainingNeedsSummary['systemStatus'] = {
    repeatability: counts.repeatability >= 2 ? 'good' : counts.repeatability === 1 ? 'developing' : 'needs_focus',
    threshold_support: counts.threshold_support >= 2 ? 'good' : counts.threshold_support === 1 ? 'developing' : 'needs_focus',
    race_specificity: counts.race_like >= 1 ? 'good' : eventPressure === 'near' || eventPressure === 'taper' ? 'needs_focus' : 'developing',
    aerobic_durability: counts.endurance >= 2 && recentWeeklyHours >= Math.max(7.5, Number(input?.mustFollow?.maxWeeklyHours || 10) * 0.72) ? 'good' : counts.endurance >= 1 ? 'developing' : 'needs_focus',
  };
  const priorities: Array<TrainingNeedsSummary['primaryLimiter']> = ['repeatability', 'threshold_support', 'race_specificity', 'aerobic_durability'];
  const objective = input?.objective || 'repeatability';
  const primaryLimiter = objective === 'threshold_support'
    ? 'threshold_support'
    : objective === 'race_specificity'
      ? (systemStatus.race_specificity === 'needs_focus' ? 'race_specificity' : systemStatus.repeatability === 'needs_focus' ? 'repeatability' : 'threshold_support')
      : priorities.find((key) => systemStatus[key] === 'needs_focus') || 'repeatability';
  const protectedStrengths = priorities.filter((key) => systemStatus[key] === 'good');
  return { freshnessState, eventPressure, primaryLimiter, protectedStrengths, systemStatus, counts, recentWeeklyHours };
}

export function buildBlockDecisionSummary(
  needs: TrainingNeedsSummary,
  input?: { objective?: string; ambition?: string },
): BlockDecisionSummary {
  const objective = (input?.objective || 'repeatability') as BlockDecisionSummary['monthObjective'];
  const monthObjective = objective === 'repeatability' || objective === 'threshold_support' || objective === 'race_specificity'
    ? objective
    : needs.primaryLimiter === 'threshold_support'
      ? 'threshold_support'
      : needs.primaryLimiter === 'race_specificity'
        ? 'race_specificity'
        : 'repeatability';
  const firstFocus = needs.freshnessState === 'blocked'
    ? 'freshen'
    : needs.protectedStrengths.includes('threshold_support') && needs.primaryLimiter === 'repeatability'
      ? 'threshold_support'
      : monthObjective === 'threshold_support'
        ? 'threshold_support'
        : monthObjective === 'race_specificity' && needs.freshnessState !== 'constrained'
          ? 'race_specificity'
          : 'threshold_support';
  const secondFocus = monthObjective === 'race_specificity'
    ? 'race_specificity'
    : needs.primaryLimiter === 'repeatability'
      ? 'repeatability'
      : monthObjective === 'threshold_support'
        ? 'threshold_support'
        : 'repeatability';
  const thirdFocus = needs.eventPressure === 'near' || monthObjective === 'race_specificity' ? 'race_specificity' : secondFocus;
  return {
    monthObjective,
    primaryNeed: needs.primaryLimiter,
    weekDecisions: [
      { weekIndex: 1, focus: firstFocus },
      { weekIndex: 2, focus: secondFocus },
      { weekIndex: 3, focus: thirdFocus },
      { weekIndex: 4, focus: 'freshen' },
    ],
  };
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function zoneFocus(zoneTotals: Record<string, number> = {}): Array<{ zone: string; hours: string }> {
  return Object.entries(zoneTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([zone, secs]) => ({ zone, hours: formatDuration(secs) }));
}

function freshnessSummary(form: number): string {
  if (form <= -18) return `Freshness is constrained (Form ${form >= 0 ? '+' : ''}${form.toFixed(0)}), so the first week should not stack hidden quality.`;
  if (form <= -6) return `Freshness is slightly tight (Form ${form >= 0 ? '+' : ''}${form.toFixed(0)}), so quality should stay controlled.`;
  if (form < 6) return `Freshness is neutral enough to train (Form ${form >= 0 ? '+' : ''}${form.toFixed(0)}).`;
  return `Freshness is open enough to sharpen (Form ${form >= 0 ? '+' : ''}${form.toFixed(0)}).`;
}

type PlannerWorkoutCategory = 'recovery' | 'endurance' | 'threshold_support' | 'repeatability' | 'race_like' | 'rest';
type PlannerWorkoutFamily = 'endurance' | 'recovery' | 'tempo' | 'sweetspot' | 'threshold_support' | 'vo2_support' | 'repeatability' | 'race_specific' | 'opener';

type WorkoutCatalogEntry = {
  id: string;
  family: PlannerWorkoutFamily;
  label: string;
  preferenceTags: string[];
  researchNotes: string[];
  allowedObjectives: string[];
  phaseTags: string[];
  progressionTargets: string[];
  antiRepetitionTags: string[];
};

type PlannerIntervalContext = {
  workingThreshold?: number;
  repeatabilityDensityLow?: boolean;
  thresholdNeedsSupport?: boolean;
  raceSpecificityBias?: boolean;
  enduranceNeedsSupport?: boolean;
  taper?: boolean;
  weekIndex?: number;
  prefersVo2Support?: boolean;
  recentIntervalHints?: string[];
  requestedFocusText?: string;
};

type WorkoutLibrarySlot = 'support_primary' | 'quality_primary' | 'support_secondary' | 'quality_secondary' | 'long_endurance' | 'rest';

type CatalogSelectorContext = {
  weekFocus: 'threshold_support' | 'repeatability' | 'race_specificity' | 'freshen';
  slot: WorkoutLibrarySlot;
  objective: string;
  freshnessState: 'blocked' | 'constrained' | 'usable' | 'fresh';
  eventPressure: 'far' | 'medium' | 'near' | 'taper';
  phaseTag: 'base' | 'build' | 'specific' | 'taper';
  recentIntervalHints: string[];
  requestedFocusText: string;
  isLighterWeek: boolean;
  alreadyChosenFamilies?: PlannerWorkoutFamily[];
  preferredCategory?: PlannerWorkoutCategory;
  index: number;
  intervalContext: PlannerIntervalContext;
};

type CatalogSelection = {
  label: string;
  category: PlannerWorkoutCategory;
  intervalLabel: string;
  family: PlannerWorkoutFamily;
  rationaleTags: string[];
};

const SLOT_ALLOWED_FAMILIES: Record<WorkoutLibrarySlot, PlannerWorkoutFamily[]> = {
  support_primary: ['endurance', 'tempo', 'sweetspot', 'threshold_support', 'recovery'],
  quality_primary: ['repeatability', 'threshold_support', 'race_specific', 'vo2_support'],
  support_secondary: ['recovery', 'endurance', 'tempo', 'sweetspot', 'threshold_support'],
  quality_secondary: ['threshold_support', 'repeatability', 'race_specific', 'vo2_support', 'opener', 'tempo', 'sweetspot'],
  long_endurance: ['endurance'],
  rest: [],
};

const WORKOUT_CATALOG: WorkoutCatalogEntry[] = [
  {
    id: 'endurance-support',
    family: 'endurance',
    label: 'Support endurance',
    preferenceTags: ['z2', 'durability'],
    researchNotes: ['Steady endurance support keeps frequency repeatable and preserves aerobic durability between harder sessions.'],
    allowedObjectives: ['repeatability', 'threshold_support', 'race_specificity', 'aerobic_support', 'consistency', 'rebuild', 'taper'],
    phaseTags: ['base', 'build', 'specific', 'taper'],
    progressionTargets: ['aerobic_durability'],
    antiRepetitionTags: ['steady_endurance'],
  },
  {
    id: 'recovery-openers',
    family: 'recovery',
    label: 'Recovery + openers',
    preferenceTags: ['recovery', 'openers'],
    researchNotes: ['A light recovery spin plus openers can keep feel without adding meaningful fatigue in a freshen week.'],
    allowedObjectives: ['repeatability', 'threshold_support', 'race_specificity', 'aerobic_support', 'consistency', 'rebuild', 'taper'],
    phaseTags: ['specific', 'taper'],
    progressionTargets: ['freshness'],
    antiRepetitionTags: ['openers', 'recovery_spin'],
  },
  {
    id: 'event-openers',
    family: 'opener',
    label: 'Openers',
    preferenceTags: ['openers', 'neuromuscular_readiness'],
    researchNotes: ['Short opener work can preserve feel and readiness when event pressure is high without turning the day into a full quality load.'],
    allowedObjectives: ['race_specificity', 'taper'],
    phaseTags: ['specific', 'taper'],
    progressionTargets: ['freshness', 'race_tolerance'],
    antiRepetitionTags: ['openers', 'primer'],
  },
  {
    id: 'repeatability-30-15',
    family: 'repeatability',
    label: 'Repeatability density set',
    preferenceTags: ['track_endurance', 'micro_intervals'],
    researchNotes: ['Short-interval repeatability work supports severe-intensity repeatability and race-specific tolerance.'],
    allowedObjectives: ['repeatability', 'race_specificity'],
    phaseTags: ['build', 'specific'],
    progressionTargets: ['repeatability_density', 'anaerobic_repeatability'],
    antiRepetitionTags: ['30_15', 'micro_interval'],
  },
  {
    id: 'vo2-5x4',
    family: 'vo2_support',
    label: 'VO2 support',
    preferenceTags: ['vo2_support', 'aerobic_power'],
    researchNotes: ['Classic 4-5 min VO2 support intervals remain a robust aerobic-power option in trained endurance athletes.'],
    allowedObjectives: ['repeatability', 'race_specificity', 'threshold_support'],
    phaseTags: ['build', 'specific'],
    progressionTargets: ['vo2max', 'aerobic_power'],
    antiRepetitionTags: ['5x4', 'vo2_block'],
  },
  {
    id: 'tempo-steady',
    family: 'tempo',
    label: 'Tempo support',
    preferenceTags: ['tempo', 'durability'],
    researchNotes: ['Tempo work can support aerobic durability and sub-threshold repeatability between harder blocks.'],
    allowedObjectives: ['aerobic_support', 'consistency', 'threshold_support'],
    phaseTags: ['base', 'build'],
    progressionTargets: ['subthreshold_durability'],
    antiRepetitionTags: ['tempo'],
  },
  {
    id: 'sweetspot-classic',
    family: 'sweetspot',
    label: 'Sweetspot support',
    preferenceTags: ['sweetspot', 'durable_power'],
    researchNotes: ['Sweetspot work can bridge endurance and threshold support when fatigue cost must stay controlled.'],
    allowedObjectives: ['threshold_support', 'consistency', 'aerobic_support'],
    phaseTags: ['base', 'build'],
    progressionTargets: ['durable_threshold'],
    antiRepetitionTags: ['sweetspot'],
  },
  {
    id: 'threshold-over-under',
    family: 'threshold_support',
    label: 'Threshold support',
    preferenceTags: ['threshold', 'race_support'],
    researchNotes: ['Threshold and over-under work support durable race pace and lactate clearance.'],
    allowedObjectives: ['threshold_support', 'repeatability', 'race_specificity'],
    phaseTags: ['build', 'specific'],
    progressionTargets: ['threshold_durability'],
    antiRepetitionTags: ['threshold', 'over_under'],
  },
  {
    id: 'race-like-points',
    family: 'race_specific',
    label: 'Race-like session',
    preferenceTags: ['points_race', 'stochastic'],
    researchNotes: ['Race-like stochastic work should sharpen event-specific tolerance closer to competition.'],
    allowedObjectives: ['race_specificity', 'repeatability'],
    phaseTags: ['specific', 'taper'],
    progressionTargets: ['race_tolerance'],
    antiRepetitionTags: ['race_like', 'stochastic'],
  },
];

function plannedIntervalLabel(
  category: PlannerWorkoutCategory,
  index: number,
  context?: PlannerIntervalContext,
): string {
  const threshold = Math.round(Number(context?.workingThreshold || 365));
  const thresholdLow = Math.round(threshold * 0.96);
  const thresholdHigh = Math.round(threshold * 1.03);
  const repeatOn = Math.round(threshold * 1.1);
  const repeatOff = Math.round(threshold * 0.55);
  const weekIndex = Number(context?.weekIndex || 0);
  if (category === 'repeatability') {
    const recentHints = (context?.recentIntervalHints || []).join(' ').toLowerCase();
    if (/3x10x30\/15/.test(recentHints)) return `2x8x30/15 @ ${repeatOn}w/${repeatOff}w`;
    if (weekIndex >= 2) return `2x10x40/20 @ ${repeatOn}w/${repeatOff}w`;
    if (index >= 3) return `2x10x40/20 @ ${repeatOn}w/${repeatOff}w`;
    if (index === 2 || weekIndex === 1) return `2x8x30/15 @ ${repeatOn}w/${repeatOff}w`;
    if (context?.repeatabilityDensityLow) return `3x10x30/15 @ ${repeatOn}w/${repeatOff}w`;
    return `3x8x30/15 @ ${repeatOn}w/${repeatOff}w`;
  }
  if (category === 'threshold_support') {
    if (weekIndex >= 1 && !context?.thresholdNeedsSupport) return `2x(12min over-under) @ ${thresholdLow}-${thresholdHigh}w`;
    if (index >= 3 && !context?.thresholdNeedsSupport) return `2x(12min over-under) @ ${thresholdLow}-${thresholdHigh}w`;
    if (context?.thresholdNeedsSupport) return `3x12min @ ${thresholdLow}-${thresholdHigh}w`;
    if (index === 3) return `3x10min @ ${thresholdLow}-${thresholdHigh}w`;
    return `2x15min @ ${thresholdLow}-${thresholdHigh}w`;
  }
  if (category === 'race_like') {
    if (weekIndex >= 2) return 'pursuit build + 3x4min race pace set';
    if (index >= 4) return 'pursuit build + 3x4min race pace set';
    if (context?.raceSpecificityBias) return 'scratch/openers + 6x2min stochastic set';
    return 'points-race jumps + 4x10s kick set';
  }
  if (category === 'endurance') return context?.enduranceNeedsSupport ? 'Z2 durability support 2.5-4h' : index === 4 ? 'Z2 aerobic support' : 'Z2 steady support';
  if (category === 'recovery') return context?.taper ? '40-50min easy spin + openers' : '45-60min easy spin';
  return 'Off / mobility';
}

function plannerCategoryForFamily(family: PlannerWorkoutFamily): PlannerWorkoutCategory {
  if (family === 'endurance' || family === 'tempo') return 'endurance';
  if (family === 'recovery') return 'recovery';
  if (family === 'threshold_support' || family === 'sweetspot') return 'threshold_support';
  if (family === 'repeatability' || family === 'vo2_support') return 'repeatability';
  return 'race_like';
}

function phaseTagForContext(args: { weekFocus: CatalogSelectorContext['weekFocus']; isLighterWeek: boolean; eventPressure: CatalogSelectorContext['eventPressure'] }): CatalogSelectorContext['phaseTag'] {
  if (args.eventPressure === 'taper' || args.isLighterWeek || args.weekFocus === 'freshen') return 'taper';
  if (args.weekFocus === 'race_specificity') return 'specific';
  return 'build';
}

function requestedFocusTags(text: string) {
  const lowered = text.toLowerCase();
  return {
    tempo: /tempo/.test(lowered),
    sweetspot: /sweetspot/.test(lowered),
    vo2: /\bvo2\b|max aerobic|aerobic power/.test(lowered),
    opener: /opener|open up|sharpen/.test(lowered),
    race: /race|specific|stochastic|pursuit|points/.test(lowered),
    threshold: /threshold|durable power|over-under/.test(lowered),
    repeatability: /repeatability|30\/15|anaerobic/.test(lowered),
  };
}

function scoreCatalogWorkout(entry: WorkoutCatalogEntry, context: CatalogSelectorContext) {
  let score = 0;
  const rationaleTags: string[] = [];
  const requestedTags = requestedFocusTags(context.requestedFocusText);
  const recentHints = context.recentIntervalHints.join(' ').toLowerCase();
  const plannerCategory = plannerCategoryForFamily(entry.family);

  if (entry.allowedObjectives.includes(context.objective)) {
    score += 5;
    rationaleTags.push('objective_fit');
  } else if (context.slot.startsWith('support_') && ['aerobic_support', 'consistency', 'rebuild', 'taper'].includes(context.objective) && ['endurance', 'recovery', 'tempo', 'sweetspot'].includes(entry.family)) {
    score += 2;
    rationaleTags.push('objective_support_fit');
  } else {
    score -= 3;
  }

  const weekFocusFamilies: Record<CatalogSelectorContext['weekFocus'], PlannerWorkoutFamily[]> = {
    threshold_support: ['threshold_support', 'sweetspot', 'tempo'],
    repeatability: ['repeatability', 'vo2_support', 'race_specific'],
    race_specificity: ['race_specific', 'opener', 'threshold_support'],
    freshen: ['recovery', 'opener', 'threshold_support'],
  };
  if (weekFocusFamilies[context.weekFocus].includes(entry.family)) {
    score += 4;
    rationaleTags.push('week_focus_fit');
  }

  if (entry.phaseTags.includes(context.phaseTag)) {
    score += 3;
    rationaleTags.push('phase_fit');
  }

  if (context.preferredCategory && plannerCategory === context.preferredCategory) {
    score += 4;
    rationaleTags.push('category_fit');
  }

  const progressionMatches = [
    context.weekFocus === 'repeatability' && entry.progressionTargets.includes('repeatability_density'),
    context.weekFocus === 'threshold_support' && entry.progressionTargets.includes('threshold_durability'),
    context.weekFocus === 'race_specificity' && entry.progressionTargets.includes('race_tolerance'),
    context.objective === 'aerobic_support' && entry.progressionTargets.includes('aerobic_durability'),
  ].some(Boolean);
  if (progressionMatches) {
    score += 2;
    rationaleTags.push('progression_fit');
  }

  if (requestedTags.tempo && entry.family === 'tempo') { score += 5; rationaleTags.push('requested_tempo'); }
  if (requestedTags.sweetspot && entry.family === 'sweetspot' && !/sweetspot/.test(recentHints)) { score += 5; rationaleTags.push('requested_sweetspot'); }
  if (requestedTags.vo2 && entry.family === 'vo2_support') { score += 5; rationaleTags.push('requested_vo2'); }
  if (requestedTags.race && entry.family === 'race_specific') { score += 4; rationaleTags.push('requested_race'); }
  if (requestedTags.threshold && entry.family === 'threshold_support') { score += 3; rationaleTags.push('requested_threshold'); }
  if (requestedTags.repeatability && entry.family === 'repeatability') { score += 3; rationaleTags.push('requested_repeatability'); }
  if (requestedTags.opener && (entry.family === 'recovery' || entry.family === 'opener')) { score += 4; rationaleTags.push('requested_openers'); }

  if (context.freshnessState === 'blocked' || context.freshnessState === 'constrained') {
    if (['vo2_support', 'repeatability', 'race_specific'].includes(entry.family)) score -= 5;
    if (['endurance', 'recovery', 'tempo', 'sweetspot', 'threshold_support'].includes(entry.family)) score += 2;
    rationaleTags.push('freshness_adjusted');
  } else if (context.freshnessState === 'fresh' && ['repeatability', 'vo2_support', 'race_specific'].includes(entry.family)) {
    score += 1;
  }

  if (context.eventPressure === 'near' || context.eventPressure === 'taper') {
    if (entry.family === 'race_specific') { score += 4; rationaleTags.push('event_pressure_race'); }
    if (entry.family === 'recovery' && /openers/i.test(entry.label)) { score += 3; rationaleTags.push('event_pressure_openers'); }
  }

  const antiRepeatHit = entry.antiRepetitionTags.some((tag) => recentHints.includes(tag.replaceAll('_', ' ')) || recentHints.includes(tag));
  if (antiRepeatHit) {
    score -= 4;
    rationaleTags.push('anti_repetition_penalty');
  }

  if (context.alreadyChosenFamilies?.includes(entry.family)) {
    score -= 3;
    rationaleTags.push('same_family_week_penalty');
  }

  if (context.slot === 'support_primary' && entry.family === 'recovery') score -= 6;
  if (context.slot === 'support_secondary' && context.weekFocus === 'freshen' && context.isLighterWeek && entry.family === 'recovery') score += 6;
  if (context.slot === 'quality_primary' && ['endurance', 'recovery', 'tempo'].includes(entry.family)) score -= 6;
  if (context.slot === 'quality_secondary' && context.isLighterWeek && entry.family === 'vo2_support') score -= 6;
  if (context.slot === 'quality_secondary' && context.weekFocus === 'repeatability' && entry.family === 'race_specific') score += 3;

  return { score, rationaleTags };
}

function buildCatalogSelection(entry: WorkoutCatalogEntry, context: CatalogSelectorContext, rationaleTags: string[]): CatalogSelection {
  const family = entry.family;
  const category = plannerCategoryForFamily(family);
  if (family === 'tempo') return { label: 'Tempo support', category, intervalLabel: '2x20min tempo @ 290-315w', family, rationaleTags };
  if (family === 'sweetspot') return { label: 'Sweetspot support', category, intervalLabel: '3x15min sweetspot @ 320-340w', family, rationaleTags };
  if (family === 'vo2_support') return { label: 'VO2 support', category, intervalLabel: '5x4min max aerobic support @ 390-410w', family, rationaleTags };
  if (family === 'race_specific') {
    const label = context.weekFocus === 'repeatability' ? 'Race-pace bridge' : 'Race-like session';
    const intervalLabel = context.weekFocus === 'repeatability'
      ? 'race pace jumps + 4x2min stochastic bridge'
      : plannedIntervalLabel('race_like', context.index, context.intervalContext);
    return { label, category, intervalLabel, family, rationaleTags };
  }
  if (family === 'recovery') {
    return {
      label: context.weekFocus === 'freshen' && context.isLighterWeek ? 'Recovery + openers' : 'Recovery spin',
      category,
      intervalLabel: plannedIntervalLabel('recovery', context.index, { ...context.intervalContext, taper: context.weekFocus === 'freshen' || context.isLighterWeek || context.eventPressure === 'taper' }),
      family,
      rationaleTags,
    };
  }
  if (family === 'opener') {
    return {
      label: 'Openers',
      category,
      intervalLabel: '3x1min progressive openers + flying efforts',
      family,
      rationaleTags,
    };
  }
  if (family === 'threshold_support') {
    return {
      label: context.slot === 'quality_primary' ? 'Threshold support anchor' : context.weekFocus === 'freshen' && context.isLighterWeek ? 'Threshold opener set' : 'Threshold support',
      category,
      intervalLabel: context.weekFocus === 'freshen' && context.isLighterWeek
        ? plannedIntervalLabel('threshold_support', context.index, { ...context.intervalContext, thresholdNeedsSupport: false, taper: true })
        : plannedIntervalLabel('threshold_support', context.index, context.intervalContext),
      family,
      rationaleTags,
    };
  }
  if (family === 'endurance') {
    return {
      label: context.slot === 'long_endurance' ? (context.isLighterWeek ? 'Endurance support' : 'Long endurance support') : 'Support endurance',
      category,
      intervalLabel: plannedIntervalLabel('endurance', context.index, context.intervalContext),
      family,
      rationaleTags,
    };
  }
  return {
    label: entry.label,
    category,
    intervalLabel: plannedIntervalLabel(category, context.index, context.intervalContext),
    family,
    rationaleTags,
  };
}

function selectCatalogWorkout(context: CatalogSelectorContext): CatalogSelection {
  const allowedFamilies = SLOT_ALLOWED_FAMILIES[context.slot] || [];
  const candidates = WORKOUT_CATALOG.filter((entry) => allowedFamilies.includes(entry.family));
  const scored = candidates
    .map((entry) => ({ entry, ...scoreCatalogWorkout(entry, context) }))
    .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label));
  const winner = scored[0]?.entry || WORKOUT_CATALOG[0]!;
  const rationaleTags = scored[0]?.rationaleTags || ['fallback'];
  return buildCatalogSelection(winner, context, rationaleTags);
}

function selectWorkoutFromLibrary(args: {
  weekFocus: 'threshold_support' | 'repeatability' | 'race_specificity' | 'freshen';
  slot: WorkoutLibrarySlot;
  category?: PlannerWorkoutCategory;
  index: number;
  context: PlannerIntervalContext;
  isLighterWeek: boolean;
  objective: string;
  freshnessState: 'blocked' | 'constrained' | 'usable' | 'fresh';
  eventPressure: 'far' | 'medium' | 'near' | 'taper';
  alreadyChosenFamilies?: PlannerWorkoutFamily[];
}): { label: string; category: PlannerWorkoutCategory; intervalLabel: string; family: PlannerWorkoutFamily | 'rest' } {
  const { weekFocus, slot, category, index, context, isLighterWeek, objective, freshnessState, eventPressure, alreadyChosenFamilies } = args;

  if (slot === 'rest') {
    return {
      label: 'Rest',
      category: 'rest',
      intervalLabel: plannedIntervalLabel('rest', index, context),
      family: 'rest',
    };
  }

  const phaseTag = phaseTagForContext({ weekFocus, isLighterWeek, eventPressure });
  const selection = selectCatalogWorkout({
    weekFocus,
    slot,
    objective,
    freshnessState,
    eventPressure,
    phaseTag,
    recentIntervalHints: context.recentIntervalHints || [],
    requestedFocusText: context.requestedFocusText || '',
    isLighterWeek,
    alreadyChosenFamilies,
    preferredCategory: category,
    index,
    intervalContext: context,
  });

  return {
    label: selection.label,
    category: selection.category,
    intervalLabel: selection.intervalLabel,
    family: selection.family,
  };
}

function mondayOf(dateString: string): Date {
  const d = new Date(`${dateString}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekWindowForToday(today: string) {
  const start = mondayOf(today);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start: isoDate(start), end: isoDate(end) };
}

function currentWeekCompletedRows(live: LiveState | null | undefined) {
  const today = live?.today || todayIso();
  const window = weekWindowForToday(today);
  return (live?.recent_rows || []).filter((row) => {
    const date = row.start_date_local.slice(0, 10);
    return date >= window.start && date <= today;
  });
}

function summarizeWorkout(workout: { date: string; label: string; category?: string; durationMinutes?: number; targetLoad?: number }) {
  return `${workout.date} • ${workout.label}${workout.durationMinutes ? ` • ${workout.durationMinutes}m` : ''}${workout.targetLoad ? ` • L${workout.targetLoad}` : ''}`;
}

function runtimeWorkoutCategory(label?: string) {
  const text = (label || '').toLowerCase();
  if (text.includes('repeat')) return 'repeatability' as const;
  if (text.includes('threshold')) return 'threshold_support' as const;
  if (text.includes('race')) return 'race_like' as const;
  if (text.includes('recover')) return 'recovery' as const;
  if (text.includes('rest')) return 'rest' as const;
  return 'endurance' as const;
}

function activePlanningIntentFromCycle(cycle: PlanningCycle) {
  return `${cycle.primaryFocus} • ${cycle.phaseType}`;
}

function weekSpanFromDraftWeek(week: MonthlyPlannerDraftPayload['weeks'][number], fallbackToday: string) {
  const dates = [...(week.completedThisWeek || []), ...week.workouts]
    .map((workout) => workout.date)
    .filter(Boolean)
    .sort();
  const window = weekWindowForToday(dates[0] || fallbackToday);
  if (!dates.length) return window;
  return {
    start: dates[0]! < window.start ? dates[0]! : window.start,
    end: dates[dates.length - 1]! > window.end ? dates[dates.length - 1]! : window.end,
  };
}

function currentWeekDraftWeek(draft?: MonthlyPlannerDraftPayload | null, today?: string) {
  if (!draft?.weeks?.length) return null;
  const current = today || todayIso();
  const liveWindow = weekWindowForToday(current);
  return draft.weeks.find((week) => {
    const span = weekSpanFromDraftWeek(week, current);
    return liveWindow.start <= span.end && liveWindow.end >= span.start;
  }) || draft.weeks[0] || null;
}

export function replaceCurrentWeekWithRuntime(args: {
  weeks: MonthlyPlannerDraftPayload['weeks'];
  today: string;
  cycle: PlanningCycle | null;
  live: LiveState | null | undefined;
}) {
  const { weeks, today, cycle, live } = args;
  if (!weeks?.length || !cycle?.days?.length) return weeks;
  const currentWeek = currentWeekDraftWeek({ monthStart: '', objective: '', ambition: '', assumptions: { ctl: 0, atl: 0, form: 0, recentSummary: [], availabilitySummary: [], guardrailSummary: [] }, weeks }, today);
  if (!currentWeek) return weeks;

  const { start: weekStart, end: weekEnd } = weekSpanFromDraftWeek(currentWeek, today);
  const cycleDays = cycle.days
    .filter((day) => day.date >= weekStart && day.date <= weekEnd)
    .map((day, index) => ({
      id: `runtime_${day.id}`,
      date: day.date,
      label: day.plannedLabel,
      intervalLabel: day.plannedStructure,
      category: runtimeWorkoutCategory(day.plannedLabel),
      durationMinutes: day.plannedDurationMin,
      targetLoad: day.plannedLoadMin,
      locked: day.date <= today,
      status: day.date < today ? 'completed' as const : 'planned' as const,
      sortIndex: index,
    }));

  const completedThisWeek = (live?.recent_rows || [])
    .filter((row) => row.start_date_local?.slice(0, 10) >= weekStart && row.start_date_local?.slice(0, 10) <= today)
    .map((row, index) => ({
      id: `done_${row.activity_id || index}`,
      date: row.start_date_local.slice(0, 10),
      label: row.summary?.short_label || row.session_type || row.name || 'Completed',
      intervalLabel: (row.summary as { structure_label?: string } | undefined)?.structure_label,
      category: runtimeWorkoutCategory(row.session_type || row.summary?.short_label || row.name),
      durationMinutes: row.duration_s ? Math.round(row.duration_s / 60) : undefined,
      targetLoad: row.training_load ? Math.round(row.training_load) : undefined,
      locked: true,
      status: 'completed' as const,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const plannedWorkouts = cycleDays
    .filter((day) => day.date >= today)
    .map(({ sortIndex: _sortIndex, ...workout }) => workout);

  const visibleWeekWorkouts = [...completedThisWeek, ...plannedWorkouts];
  const runtimeWeek = {
    ...currentWeek,
    intent: activePlanningIntentFromCycle(cycle),
    targetHours: Number((visibleWeekWorkouts.reduce((acc, day) => acc + Number(day.durationMinutes || 0), 0) / 60).toFixed(1)),
    targetLoad: visibleWeekWorkouts.reduce((acc, day) => acc + Number(day.targetLoad || 0), 0),
    completedThisWeek,
    workouts: plannedWorkouts,
  };

  return weeks.map((week) => week.weekIndex === currentWeek.weekIndex ? runtimeWeek : week);
}

function computePowerProfile(live: LiveState | null) {
  const rows = live?.recent_rows || [];
  const counts = recentSessionCounts(rows);
  const repeatabilityHits = counts['broken VO2 / repeatability session'] || 0;
  const thresholdHits = counts['threshold / race-support ride'] || 0;
  const raceLikeHits = counts['race or race-like stochastic session'] || 0;
  const enduranceHits = counts['endurance / Z2 ride'] || 0;
  const ctl = Number(live?.wellness?.ctl || 0);
  const atl = Number(live?.wellness?.atl || 0);
  const form = ctl - atl;

  const longRows = rows.filter((row) => Number(row.duration_s || 0) >= 3 * 3600);
  const thresholdRows = rows.filter((row) => row.session_type === 'threshold / race-support ride');
  const repeatRows = rows.filter((row) => row.session_type === 'broken VO2 / repeatability session');
  const avgThresholdNp = mean(thresholdRows.map((row) => Number(row.weighted_avg_watts || 0)).filter(Boolean));
  const avgRepeatLoad = mean(repeatRows.map((row) => Number(row.training_load || 0)).filter(Boolean));
  const avgLongHours = mean(longRows.map((row) => Number(row.duration_s || 0) / 3600).filter(Boolean));
  const highIntensityMinutes = rows.reduce((acc, row) => acc + ((row.zone_times?.Z5 || 0) + (row.zone_times?.Z6 || 0) + (row.zone_times?.Z7 || 0)) / 60, 0);
  const thresholdMinutes = rows.reduce((acc, row) => acc + ((row.zone_times?.Z4 || 0) + (row.zone_times?.SS || 0)) / 60, 0);
  const enduranceMinutes = rows.reduce((acc, row) => acc + ((row.zone_times?.Z2 || 0)) / 60, 0);
  const workingThreshold = Number(live?.working_threshold_w || 0);

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (repeatabilityHits >= 1 && avgRepeatLoad >= 120) {
    strengths.push(`Repeatability looks like a real current strength: ${repeatabilityHits} recent session${repeatabilityHits > 1 ? 's' : ''} with average load ${avgRepeatLoad.toFixed(0)}.`);
  } else {
    weaknesses.push('Repeatability does not yet show enough recent density or cost to call it a live strength.');
  }

  if (thresholdHits >= 1 && avgThresholdNp >= Math.max(300, workingThreshold * 0.8)) {
    strengths.push(`Threshold support is showing up usefully: ${thresholdHits} recent session${thresholdHits > 1 ? 's' : ''} with average NP ${avgThresholdNp.toFixed(0)} W.`);
  } else {
    weaknesses.push('Threshold / race-support needs a clearer recent execution signal.');
  }

  if (avgLongHours >= 3) {
    strengths.push(`Durability support is present with long rides averaging ${avgLongHours.toFixed(1)} h.`);
  } else {
    weaknesses.push('Long-endurance durability support looks light in the recent live window.');
  }

  if (raceLikeHits >= 1) {
    strengths.push('Race-like stochastic demand is present in the recent history.');
  } else {
    weaknesses.push('Race-like stochastic tolerance is still underexposed versus the goal demand.');
  }

  if (form <= -18) {
    weaknesses.push(`Freshness is currently constrained (Form ${form.toFixed(0)}), so the profile should be interpreted with caution.`);
  }

  const monthFocus = zoneFocus(live?.month_zone_totals || {});

  return {
    strengths,
    weaknesses,
    powerCurveHighlights: [
      {
        label: 'Working threshold anchor',
        value: workingThreshold ? `${workingThreshold} W` : 'Not loaded',
        interpretation: 'Use this as the practical support anchor, then judge whether it stays repeatable and not just possible once.',
      },
      {
        label: 'Threshold support signal',
        value: thresholdHits ? `${avgThresholdNp.toFixed(0)} W avg NP across ${thresholdHits} recent threshold session${thresholdHits > 1 ? 's' : ''}` : 'No recent threshold anchor',
        interpretation: 'This is a better live support marker than a generic FTP line alone.',
      },
      {
        label: 'Repeatability signal',
        value: repeatabilityHits ? `${avgRepeatLoad.toFixed(0)} avg load across ${repeatabilityHits} repeatability session${repeatabilityHits > 1 ? 's' : ''}` : 'No recent repeatability anchor',
        interpretation: 'Track-oriented repeatability matters more than a generic VO2 label for your target.',
      },
      {
        label: 'High-intensity exposure',
        value: `${highIntensityMinutes.toFixed(0)} min in Z5+ / ${thresholdMinutes.toFixed(0)} min in Z4+SS`,
        interpretation: 'Shows whether the recent block is biased toward support work or truly decisive intensity.',
      },
      {
        label: 'Endurance support volume',
        value: `${enduranceMinutes.toFixed(0)} min in Z2`,
        interpretation: 'Support endurance should underpin the key work rather than disappear while chasing sharpness.',
      },
      {
        label: 'Current freshness',
        value: `CTL ${ctl.toFixed(0)} • ATL ${atl.toFixed(0)} • Form ${form >= 0 ? '+' : ''}${form.toFixed(0)}`,
        interpretation: 'Daily decisions should be filtered through freshness before forcing the nominal plan.',
      },
    ],
    trendDirectionBySystem: [
      { system: 'Repeatability', trend: repeatabilityHits >= 1 ? 'up' : 'needs_attention', note: `Recent repeatability hits: ${repeatabilityHits}.` },
      { system: 'Threshold support', trend: thresholdHits >= 1 ? 'steady' : 'needs_attention', note: thresholdHits >= 1 ? `Recent threshold NP trend around ${avgThresholdNp.toFixed(0)} W.` : 'No recent threshold support anchor.' },
      { system: 'Durability', trend: avgLongHours >= 3 ? 'steady' : 'needs_attention', note: avgLongHours ? `Long rides average ${avgLongHours.toFixed(1)} h.` : 'No strong long-ride support signal.' },
      { system: 'Race-like tolerance', trend: raceLikeHits >= 1 ? 'steady' : 'needs_attention', note: raceLikeHits >= 1 ? 'Recent race-like demand exists.' : 'Needs more race-like stochastic demand.' },
    ] as Array<{ system: string; trend: 'up' | 'steady' | 'needs_attention'; note: string }>,
    goalAlignmentSummary: [
      `Season focus: ${live?.season_focus || 'track endurance'}.`,
      `Current phase: ${live?.season_phase || 'not loaded'}.`,
      'The live profile should be held against repeatability, race-specificity, threshold support, and freshness management rather than generic FTP improvement.',
    ],
    recommendedEmphasisChanges: [
      'Keep the daily recommendation inside Dashboard and Plan.',
      'Use Plan for the bigger power-profile, goal-alignment, and adaptation picture.',
      avgLongHours < 3 ? 'Reinforce durability support before stacking more sharp work.' : 'Durability support is present enough to let quality stay specific.',
    ],
    analysisViewRoute: appRoutes.plan,
    latestWorkoutDay: (live?.latest_day_rows || []).map(latestWorkoutLine),
    monthZoneFocus: monthFocus,
  };
}

export function buildPlannerDayPayload(user: UserRecord, live?: LiveState | null): PlannerDayPayload {
  const ctl = Number(live?.wellness?.ctl || 0);
  const atl = Number(live?.wellness?.atl || 0);
  const form = ctl - atl;
  const latestSummary = (live?.latest_day_rows || []).map(latestWorkoutLine).join(' ⟡ ');
  const plannedToday = planLabel(live?.today_plan);
  const plannedTomorrow = planLabel(live?.tomorrow_plan);
  const usingAuthorizedLiveData = Boolean(live);

  return {
    date: live?.today || todayIso(),
    plannedToday,
    plannedTomorrow,
    shouldActuallyHappenToday: !usingAuthorizedLiveData
      ? 'No live athlete data is loaded for this account yet.'
      : plannedToday === 'Rest day'
        ? 'Today should be a real rest day.'
        : plannedToday === 'Recovery'
          ? 'Today should stay genuinely light and recovery-focused.'
          : form <= -18
            ? 'Keep today supportive or reduce the quality dose.'
            : 'Stay aligned with the planned session, but only if it protects the next decisive quality slot.',
    why: !usingAuthorizedLiveData
      ? `${user.displayName}, live planner data is only shown for the Intervals athlete linked to your own login. Connect your account before using analysis or planning decisions from this view.`
      : plannedToday === 'Rest day'
        ? 'Protect freshness completely today so the next decisive session starts from a better place rather than carrying unnecessary fatigue.'
        : plannedToday === 'Recovery'
          ? 'The planned intent is recovery, so keep the cost low instead of leaking load into a support day.'
          : form <= -18
            ? 'Freshness is constrained, so preserve the next decisive session rather than chasing the nominal load.'
            : 'Freshness is acceptable enough to respect the plan while still filtering it through recovery and next-session protection.',
    nextToProtect: usingAuthorizedLiveData
      ? plannedToday === 'Rest day'
        ? 'Protect tomorrow and the next decisive quality slot by keeping today fully off.'
        : 'Protect the next repeatability or threshold anchor instead of leaking load into support days.'
      : 'Protect account-scoped data access first, then load the next decisive training anchor from your own Intervals connection.',
    adaptationState: !usingAuthorizedLiveData ? 'watch' : form <= -22 ? 'sick_readjustment' : 'watch',
    planChangeSummary: usingAuthorizedLiveData
      ? 'No remote calendar edits allowed yet; planner remains internal/read-only toward Intervals.'
      : 'Planner remains read-only and now only exposes live training data for the athlete linked to the logged-in user.',
    intervalsPlanWriteState: 'disabled_read_only',
    ctl,
    atl,
    form,
    goalRaceDate: live?.goal_race_date,
    latestWorkoutSummary: latestSummary || undefined,
  };
}

export function buildPowerProfilePayload(live?: LiveState | null): PowerProfilePayload {
  return computePowerProfile(live ?? null);
}

export function buildGoalPayload(
  live?: LiveState | null,
  customGoals: Array<{ type: string; title: string; targetDate?: string; status: string; priority?: string; notes?: string; updatedAt?: string }> = [],
): GoalPayload {
  const profile = computePowerProfile(live ?? null);
  const primaryWeakness = profile.weaknesses[0] || 'No current weakness summary loaded yet.';
  const defaultGoals = [
    { type: 'A_race', title: 'Arrive decisive for the target track-endurance race', targetDate: live?.goal_race_date || '2026-05-12', status: 'active' },
    { type: 'capability_goal', title: 'Raise repeatability under load', status: 'active' },
    { type: 'capability_goal', title: 'Keep threshold support repeatable without excess fatigue', status: 'active' },
  ];
  const activeGoals = customGoals.length
    ? customGoals.map((goal) => ({ type: goal.type, title: goal.title, targetDate: goal.targetDate, status: goal.status }))
    : defaultGoals;
  return {
    activeGoals,
    latestGoalChanges: [
      { title: 'Current weakness pressure', reason: primaryWeakness, effect: 'Use this to bias the next block without changing Intervals remotely.' },
    ],
    currentPlanFitSummary: 'The current plan should preserve the race goal while adapting the emphasis when the live profile shows clear gaps or freshness risk.',
    goalHistory: customGoals.map((goal) => ({
      title: goal.title,
      priority: goal.priority || 'support',
      updatedAt: goal.updatedAt || todayIso(),
      notes: goal.notes,
    })),
  };
}

export function buildAdaptationPayload(
  live?: LiveState | null,
  adaptationEntries: Array<{ date: string; status: string; action: string; illness: boolean; note?: string }> = [],
): AdaptationPayload {
  const ctl = Number(live?.wellness?.ctl || 0);
  const atl = Number(live?.wellness?.atl || 0);
  const form = ctl - atl;
  const latestEntry = adaptationEntries[0];
  const trigger = latestEntry?.illness
    ? 'Illness/disruption check-in active'
    : form <= -20
      ? 'High fatigue / freshness protection'
      : 'Read-only planner safety mode';
  return {
    adaptationTrigger: trigger,
    sessionsChanged: [
      `Planned today: ${planLabel(live?.today_plan)}`,
      `Planned tomorrow: ${planLabel(live?.tomorrow_plan)}`,
      latestEntry ? `Latest check-in action: ${latestEntry.action}` : 'No manual check-in recorded yet.',
      'No remote Intervals plan mutations permitted.',
    ],
    blockChangeSummary: 'Adaptation feedback is visible in the product, but the platform must not push changes into Intervals yet.',
    returnToFullTrainingCriteria: [
      'Implement stronger authentication and authorization.',
      'Add ownership checks for Intervals-linked accounts.',
      'Keep explicit write guard until those checks are verified.',
    ],
    userFacingExplanation: `Planner remains read-only toward Intervals while still showing live CTL ${ctl.toFixed(0)}, ATL ${atl.toFixed(0)}, and Form ${form >= 0 ? '+' : ''}${form.toFixed(0)} so daily decisions can react without altering the external calendar.`,
    confidence: 'medium',
    manualReviewRecommended: true,
    recentCheckins: adaptationEntries,
  };
}

export function buildMonthlyPlannerContextPayload(
  live?: LiveState | null,
  currentDirection?: string,
): MonthlyPlannerContextPayload {
  const rows = live?.recent_rows || [];
  const ctl = Number(live?.wellness?.ctl || 0);
  const atl = Number(live?.wellness?.atl || 0);
  const form = ctl - atl;
  const keySessions = rows.slice(0, 4).map((row) => latestWorkoutLine(row));
  const repeatabilityHits = rows.filter((row) => classifyRecentRow(row) === 'repeatability').length;
  const thresholdHits = rows.filter((row) => classifyRecentRow(row) === 'threshold_support').length;
  const raceLikeHits = rows.filter((row) => classifyRecentRow(row) === 'race_like').length;
  const volumeHours = rows.reduce((acc, row) => acc + Number(row.duration_s || 0), 0) / 3600;
  const today = live?.today || todayIso();
  const daysToGoal = live?.goal_race_date
    ? Math.round((new Date(`${live.goal_race_date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400000)
    : null;
  const eventProximity = daysToGoal === null
    ? 'No primary event detected in the live data yet.'
    : daysToGoal < 0
      ? 'Primary event date has passed in the live data.'
      : `${daysToGoal} days to the primary event.`;
  const recentFocus = [
    `Repeatability sessions: ${repeatabilityHits}`,
    `Threshold sessions: ${thresholdHits}`,
    `Race-like sessions: ${raceLikeHits}`,
  ];
  const mainImplication = form <= -18
    ? 'Freshness should shape the opening month build more than adding extra density.'
    : daysToGoal !== null && daysToGoal <= 35
      ? 'The month should tilt toward race specificity as the event gets closer.'
      : repeatabilityHits < thresholdHits
        ? 'The month should lift repeatability so threshold support becomes more usable under pressure.'
        : 'The month can keep building support without overloading the first week.';

  return {
    goalEvent: {
      title: live?.goal_race_date ? 'Primary target event detected' : 'No primary event detected yet',
      date: live?.goal_race_date,
      currentDirection,
    },
    currentState: {
      ctl,
      atl,
      form,
      freshnessSummary: freshnessSummary(form),
      phase: live?.season_phase || 'Current track-endurance block',
    },
    recentHistory: {
      loadSummary: `${rows.length} recent sessions • ${volumeHours.toFixed(1)} h total visible load window.`,
      keySessions,
      repeatablePattern: repeatabilityHits && thresholdHits
        ? 'Threshold support and repeatability are both present enough to carry into the month draft.'
        : repeatabilityHits
          ? 'Repeatability is present, but threshold support still needs clearer reinforcement.'
          : 'Support work is present, but decisive repeatability density still needs rebuilding.',
      caution: form <= -18
        ? 'Recent load is already high enough that the opening week should protect freshness.'
        : 'Freshness is not blocking a normal build opening week yet.',
    },
    statusQuo: {
      recentFocus,
      eventProximity,
      mainImplication,
    },
    availability: {
      summary: [
        'Blank calendar days default to endurance support unless explicitly changed.',
        'Longer support work is better placed on lower-pressure days.',
      ],
    },
    guardrails: {
      summary: [
        'No back-to-back hard days unless explicitly allowed.',
        'Keep quality repeatable rather than forcing hidden third intensity days.',
      ],
    },
    toggles: {
      ignoreSickWeek: false,
      ignoreVacationWeek: false,
      useLast28DaysOnly: false,
      excludeNonPrimarySport: false,
    },
  };
}

export function buildPlanningRecommendationPayload(
  live?: LiveState | null,
  currentDirection?: string,
): PlanningRecommendationPayload {
  const context = buildMonthlyPlannerContextPayload(live, currentDirection);
  const form = context.currentState.form;
  const repeatabilityGap = /repeatability density still needs rebuilding/i.test(context.recentHistory.repeatablePattern);
  const thresholdGap = /threshold support still needs clearer reinforcement/i.test(context.recentHistory.repeatablePattern);
  const daysToGoal = live?.goal_race_date
    ? Math.round((new Date(`${live.goal_race_date}T00:00:00Z`).getTime() - new Date(`${(live?.today || todayIso())}T00:00:00Z`).getTime()) / 86400000)
    : null;
  const nearGoal = daysToGoal !== null && daysToGoal <= 35;
  const objective = form <= -18
    ? 'consistency'
    : nearGoal
      ? 'race_specificity'
      : thresholdGap
        ? 'threshold_support'
        : repeatabilityGap
          ? 'repeatability'
          : 'aerobic_support';
  const title = objective === 'race_specificity'
    ? 'Race-like month'
    : objective === 'threshold_support'
      ? 'Threshold-support month'
      : objective === 'consistency'
        ? 'Freshness-protect month'
        : objective === 'aerobic_support'
          ? 'Aerobic-support month'
          : 'Repeatability month';
  const confidence = form <= -18 || daysToGoal === null ? 'medium' as const : nearGoal || thresholdGap ? 'high' as const : 'medium' as const;
  const explanation = objective === 'consistency'
    ? 'Freshness is constrained enough that the next block should protect repeatability before adding more pressure.'
    : objective === 'race_specificity'
      ? 'The event is close enough that one quality lane should tilt clearly toward race-like track demand.'
      : objective === 'threshold_support'
        ? 'Recent work shows enough repeatability support, but threshold support still needs clearer reinforcement.'
        : objective === 'aerobic_support'
          ? 'The current picture allows a steadier support month without losing the sharper work already present.'
          : 'Recent support is visible, but decisive repeatability density still needs to become more reliable.';

  return {
    primary: {
      title,
      objective,
      confidence,
      explanation,
    },
    alternatives: [
      {
        title: 'Make it safer',
        objective: 'consistency',
        reason: 'Use this if freshness is the bigger limiter than raw fitness support right now.',
      },
      {
        title: 'Lean more threshold',
        objective: 'threshold_support',
        reason: 'Use this if you want the month anchored more clearly around threshold support and race support.',
      },
      {
        title: 'Lean more race-like',
        objective: 'race_specificity',
        reason: 'Use this if the next races matter more than building general support this month.',
      },
    ],
    rationaleBullets: [
      `Freshness: ${context.currentState.freshnessSummary}`,
      `Recent pattern: ${context.recentHistory.repeatablePattern}`,
      context.recentHistory.caution,
    ],
    riskFlags: [
      form <= -18 ? 'Opening week should stay freshness-protective.' : 'No major freshness block on the opening week.',
      nearGoal ? 'Race proximity increases the value of race-like specificity.' : 'There is still room to build support before sharpening.',
    ],
    recommendedConstraints: [
      'Keep only two real quality exposures per week.',
      'Protect the day after a hard session unless you explicitly override it.',
      'Let blank days stay endurance support unless you make them true rest.',
    ],
  };
}

type PlannedWorkout = MonthlyPlannerDraftPayload['weeks'][number]['workouts'][number] & { preferredOffset?: number };

function normalizeWeekday(day?: string, fallback = 'Sunday') {
  return (day || fallback).toLowerCase();
}

function placeWeeklyWorkouts(
  monday: Date,
  workouts: PlannedWorkout[],
  options: { restOffset: number; longOffset: number; noBackToBack: boolean },
): PlannedWorkout[] {
  const assigned = new Map<number, PlannedWorkout>();
  const hardCategories = new Set<PlannerWorkoutCategory>(['repeatability', 'threshold_support', 'race_like']);
  const searchOrder = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6];

  const canUseOffset = (offset: number, workout: PlannedWorkout) => {
    if (offset < 0 || offset > 6) return false;
    if (assigned.has(offset)) return false;
    if (workout.category === 'rest') return true;
    if (!options.noBackToBack || !hardCategories.has(workout.category)) return true;
    for (const [otherOffset, otherWorkout] of assigned.entries()) {
      if (!hardCategories.has(otherWorkout.category)) continue;
      if (Math.abs(otherOffset - offset) <= 1) return false;
    }
    return true;
  };

  const placeWorkout = (workout: PlannedWorkout, preferredOffset: number) => {
    if (workout.category === 'rest') {
      assigned.set(preferredOffset, { ...workout, date: isoDate(new Date(monday.getTime() + preferredOffset * 86400000)) });
      return;
    }
    for (const delta of searchOrder) {
      const candidate = preferredOffset + delta;
      if (!canUseOffset(candidate, workout)) continue;
      assigned.set(candidate, { ...workout, date: isoDate(new Date(monday.getTime() + candidate * 86400000)) });
      return;
    }
    for (let candidate = 0; candidate <= 6; candidate += 1) {
      if (!assigned.has(candidate)) {
        assigned.set(candidate, { ...workout, date: isoDate(new Date(monday.getTime() + candidate * 86400000)) });
        return;
      }
    }
  };

  const placementOrder = [...workouts].sort((a, b) => {
    const priority = (workout: PlannedWorkout) => {
      if (workout.category === 'rest') return 100;
      if (hardCategories.has(workout.category)) return 80;
      if (/Long endurance support|Endurance support/.test(workout.label)) return 70;
      if (workout.category === 'recovery') return 60;
      return 50;
    };
    return priority(b) - priority(a);
  });

  for (const workout of placementOrder) {
    const preferredOffset = workout.category === 'rest'
      ? options.restOffset
      : /Long endurance support|Endurance support/.test(workout.label)
        ? options.longOffset
        : workout.preferredOffset ?? 0;
    placeWorkout(workout, preferredOffset);
  }

  return [...assigned.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, workout]) => workout);
}

function capWorkoutsToTargetHours(
  workouts: PlannedWorkout[],
  targetHours: number,
): PlannedWorkout[] {
  const targetMinutes = Math.max(0, Math.round(targetHours * 60));
  if (!targetMinutes) {
    return workouts.filter((workout) => workout.category === 'rest').map((workout) => ({ ...workout, durationMinutes: 0, targetLoad: 0 }));
  }
  const priority = (workout: PlannedWorkout) => {
    if (workout.category === 'rest') return 100;
    if (workout.category === 'race_like') return 95;
    if (workout.category === 'repeatability' || workout.category === 'threshold_support') return 90;
    if (/Long endurance support|Endurance support/.test(workout.label)) return 60;
    if (workout.category === 'recovery') return 40;
    return 50;
  };
  const minimumMinutes = (workout: PlannedWorkout) => {
    if (workout.category === 'rest') return 0;
    if (workout.category === 'recovery') return 30;
    if (workout.category === 'endurance') return /Long endurance support|Endurance support/.test(workout.label) ? 60 : 45;
    return 60;
  };

  const adjusted = workouts.map((workout) => ({ ...workout }));
  let totalMinutes = adjusted.reduce((acc, workout) => acc + Number(workout.durationMinutes || 0), 0);

  for (const workout of [...adjusted].sort((a, b) => priority(a) - priority(b))) {
    if (totalMinutes <= targetMinutes) break;
    const currentMinutes = Number(workout.durationMinutes || 0);
    const floorMinutes = minimumMinutes(workout);
    const reducible = Math.max(0, currentMinutes - floorMinutes);
    if (!reducible) continue;
    const reduction = Math.min(reducible, totalMinutes - targetMinutes);
    workout.durationMinutes = currentMinutes - reduction;
    const loadPerMinute = currentMinutes > 0 ? Number(workout.targetLoad || 0) / currentMinutes : 0;
    workout.targetLoad = Math.max(0, Math.round((workout.durationMinutes || 0) * loadPerMinute));
    totalMinutes -= reduction;
  }

  return adjusted.filter((workout) => workout.category === 'rest' || Number(workout.durationMinutes || 0) > 0);
}

function ensureRestDayCount(
  workouts: PlannedWorkout[],
  monday: Date,
  desiredRestDays: number,
  preferredOffsets: number[],
): PlannedWorkout[] {
  if (desiredRestDays <= 0) return workouts.filter((workout) => workout.category !== 'rest');
  const next = [...workouts];
  const usedDates = new Set(next.map((workout) => workout.date));
  let restCount = next.filter((workout) => workout.category === 'rest').length;
  for (const offset of preferredOffsets) {
    if (restCount >= desiredRestDays) break;
    const date = isoDate(new Date(monday.getTime() + offset * 86400000));
    const existingIndex = next.findIndex((workout) => workout.date === date);
    if (existingIndex >= 0) {
      if (next[existingIndex]?.category === 'rest') {
        continue;
      }
      if (next[existingIndex]?.category === 'endurance') {
        next[existingIndex] = { ...next[existingIndex]!, label: 'Rest', intervalLabel: 'Off / mobility', category: 'rest', durationMinutes: 0, targetLoad: 0 };
        restCount += 1;
        continue;
      }
      continue;
    }
    next.push({ date, preferredOffset: offset, label: 'Rest', intervalLabel: 'Off / mobility', category: 'rest', durationMinutes: 0, targetLoad: 0, locked: false });
    usedDates.add(date);
    restCount += 1;
  }
  return next.sort((a, b) => a.date.localeCompare(b.date));
}

export function buildMonthlyPlannerDraftPayload(
  live: LiveState | null | undefined,
  input: {
    objective: string;
    ambition: string;
    currentDirection?: string;
    successMarkers?: string[];
    mustFollow?: { noBackToBackHardDays?: boolean; maxWeeklyHours?: number };
    preferences?: { restDay?: string; restDaysPerWeek?: number; longRideDay?: string };
    planEvents?: Array<{ id?: string; date: string; type?: string; title?: string; priority?: string; durationHours?: number }>;
  },
): MonthlyPlannerDraftPayload {
  const ctl = Number(live?.wellness?.ctl || 0);
  const atl = Number(live?.wellness?.atl || 0);
  const form = ctl - atl;
  const today = live?.today || todayIso();
  const monthStart = today.slice(0, 8) + '01';
  const currentWeekStart = mondayOf(today);
  const start = new Date(currentWeekStart);
  const constrained = form <= -18;
  const noBackToBack = input.mustFollow?.noBackToBackHardDays !== false;
  const objective = input.objective || 'repeatability';
  const ambition = input.ambition || 'balanced';
  const weeklyCap = input.mustFollow?.maxWeeklyHours || (ambition === 'ambitious' ? 12 : ambition === 'conservative' ? 9 : 10.5);
  const currentDirection = (input.currentDirection || '').toLowerCase();
  const goalDate = live?.goal_race_date ? new Date(`${live.goal_race_date}T00:00:00Z`) : null;
  const todayDate = new Date(`${today}T00:00:00Z`);
  const daysToGoal = goalDate ? Math.round((goalDate.getTime() - todayDate.getTime()) / 86400000) : null;
  const nearGoal = daysToGoal !== null && daysToGoal <= 35;
  const preferredRestDay = normalizeWeekday(input.preferences?.restDay, 'Saturday');
  const preferredLongRideDay = normalizeWeekday(input.preferences?.longRideDay, 'Sunday');
  const restDaysPerWeek = Math.max(0, Math.min(3, Number(input.preferences?.restDaysPerWeek ?? 1)));
  const successMarkers = input.successMarkers || [];
  const wantsFresherKeySessions = successMarkers.some((marker) => /fresher/i.test(marker));
  const weekdayOffsets: Record<string, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };
  const restOffset = weekdayOffsets[preferredRestDay] ?? 4;
  const extraRestOffset = (restOffset + 2) % 7;
  const longOffset = weekdayOffsets[preferredLongRideDay] ?? 6;
  const weekLabels = ['Stabilize', 'Build', objective === 'race_specificity' ? 'Build specific' : 'Build', objective === 'taper' ? 'Taper' : 'Absorb'] as const;
  const weekLoads = [0.92, 1, objective === 'taper' ? 0.82 : 1.03, objective === 'taper' ? 0.65 : 0.72];
  const completedThisWeek = (live?.recent_rows || [])
    .filter((row) => row.start_date_local.slice(0, 10) >= isoDate(currentWeekStart) && row.start_date_local.slice(0, 10) <= today)
    .sort((a, b) => a.start_date_local.localeCompare(b.start_date_local))
    .map((row) => ({
      date: row.start_date_local.slice(0, 10),
      label: row.summary?.short_label || row.session_type || row.name || 'Completed session',
      intervalLabel: (row.summary as { structure_label?: string; short_label?: string } | undefined)?.structure_label || row.summary?.short_label || row.session_type || row.name || 'Completed work',
      category: classifyRecentRow(row),
      durationMinutes: Math.round(Number(row.duration_s || 0) / 60),
      targetLoad: Math.round(Number(row.training_load || 0)),
      status: 'completed' as const,
      locked: true as const,
    }));
  const planningStartDate = completedThisWeek.some((row) => row.date === today)
    ? isoDate(new Date(todayDate.getTime() + 86400000))
    : today;
  const completedThisWeekHours = completedThisWeek.reduce((acc, row) => acc + Number(row.durationMinutes || 0), 0) / 60;
  const planEvents = input.planEvents || [];

  const needs = buildTrainingNeedsSummary(live, input);
  const blockDecision = buildBlockDecisionSummary(needs, { objective, ambition });

  const weeks = weekLabels.map((label, index) => {
    const monday = new Date(start);
    monday.setUTCDate(start.getUTCDate() + index * 7);
    const recentRows = live?.recent_rows || [];
    const repeatabilityHits = needs.counts.repeatability;
    const thresholdHits = needs.counts.threshold_support;
    const raceLikeHits = needs.counts.race_like;
    const enduranceHits = needs.counts.endurance;
    const recentWeeklyHours = needs.recentWeeklyHours;
    const weekDecision = blockDecision.weekDecisions[index] || blockDecision.weekDecisions[blockDecision.weekDecisions.length - 1]!;
    const repeatabilityDensityLow = repeatabilityHits < 2;
    const thresholdNeedsSupport = thresholdHits < 2 || objective === 'threshold_support' || /threshold/.test(currentDirection);
    const raceSpecificityBias = objective === 'race_specificity' || raceLikeHits < 1 || /race/.test(currentDirection) || nearGoal;
    const enduranceNeedsSupport = enduranceHits < 2 || recentWeeklyHours < Math.max(7.5, weeklyCap * 0.72);
    const taper = objective === 'taper' || index === 3 || (nearGoal && index === 3);
    const fatigueBlocked = form <= -14;
    const thresholdStable = thresholdHits >= 2 && recentRows
      .filter((row) => classifyRecentRow(row) === 'threshold_support')
      .some((row) => Number(row.weighted_avg_watts || 0) >= Math.max(330, Number(live?.working_threshold_w || 365) * 0.9));
    const repeatabilityReady = repeatabilityHits >= 2 && recentRows
      .filter((row) => classifyRecentRow(row) === 'repeatability')
      .some((row) => Number(row.training_load || 0) >= 120);
    const hardOne = weekDecision.focus === 'repeatability'
      ? 'repeatability'
      : weekDecision.focus === 'race_specificity'
        ? (fatigueBlocked ? 'threshold_support' : 'race_like')
        : 'threshold_support';
    const hardTwo = weekDecision.focus === 'freshen'
      ? 'threshold_support'
      : weekDecision.focus === 'race_specificity'
        ? (fatigueBlocked ? 'threshold_support' : 'race_like')
        : weekDecision.focus === 'repeatability'
          ? (thresholdNeedsSupport || !thresholdStable ? 'threshold_support' : 'race_like')
          : thresholdNeedsSupport || !thresholdStable
            ? 'threshold_support'
            : raceSpecificityBias && index >= 1 && !fatigueBlocked
              ? 'race_like'
              : 'threshold_support';
    const baseHours = Math.min(weeklyCap, Math.max(6.5, Number((Math.min(weeklyCap, recentWeeklyHours * (index === 3 ? 0.78 : index === 2 ? 1.04 : index === 1 ? 1 : 0.94))).toFixed(1))));
    const rawWeekHours = Number(Math.min(weeklyCap, Number((baseHours * weekLoads[index]).toFixed(1))).toFixed(1));
    const isCurrentWeek = index === 0;
    const weekStartIso = isoDate(monday);
    const weekEndIso = isoDate(new Date(monday.getTime() + 6 * 86400000));
    const weekEvents = planEvents.filter((event) => event.date >= weekStartIso && event.date <= weekEndIso);
    const eventHours = Number(weekEvents.reduce((acc, event) => acc + Number(event.durationHours || 0), 0).toFixed(1));
    const remainingDaysThisWeek = Math.max(1, Math.round((new Date(`${isoDate(new Date(monday.getTime() + 6 * 86400000))}T00:00:00Z`).getTime() - new Date(`${planningStartDate}T00:00:00Z`).getTime()) / 86400000) + 1);
    const remainingFraction = isCurrentWeek ? Number((remainingDaysThisWeek / 7).toFixed(2)) : 1;
    const remainingWeeklyCap = isCurrentWeek ? Math.max(0, Number((weeklyCap - completedThisWeekHours - eventHours).toFixed(1))) : Math.max(0, Number((weeklyCap - eventHours).toFixed(1)));
    const targetHours = Number(Math.max(0, Math.min(remainingWeeklyCap, Number((rawWeekHours * remainingFraction).toFixed(1)))).toFixed(1));
    const targetLoad = Math.round(targetHours * (index === 3 ? 42 : hardTwo === 'race_like' ? 52 : 50));
    const isLighterWeek = index === 3;
    const isRaceLikeWeek = objective === 'race_specificity' || hardTwo === 'race_like';
    const qualitySessionCap = isLighterWeek ? 85 : isRaceLikeWeek ? 90 : 95;
    const longSessionFloor = isLighterWeek ? 90 : targetHours >= 9.5 ? 150 : 120;
    const longSessionCeiling = isLighterWeek ? 120 : enduranceNeedsSupport ? 210 : 180;
    const longSessionShare = isLighterWeek ? 0.24 : enduranceNeedsSupport ? 0.34 : 0.3;
    const supportSessionCap = isLighterWeek ? 90 : 105;
    const supportSessionShare = isLighterWeek ? 0.12 : isRaceLikeWeek ? 0.13 : 0.14;
    const qualityOneShare = isRaceLikeWeek ? 0.11 : 0.12;
    const qualityTwoShare = isRaceLikeWeek ? 0.12 : 0.13;
    const longMinutes = Math.min(longSessionCeiling, Math.max(longSessionFloor, Math.round(targetHours * 60 * longSessionShare)));
    const supportMinutes = Math.min(supportSessionCap, Math.max(60, Math.round(targetHours * 60 * supportSessionShare)));
    const qualityOneMinutes = Math.min(qualitySessionCap, Math.max(70, Math.round(targetHours * 60 * qualityOneShare)));
    const qualityTwoMinutes = Math.min(qualitySessionCap, Math.max(75, Math.round(targetHours * 60 * qualityTwoShare)));
    const recoveryMinutes = noBackToBack ? (taper ? 50 : 60) : Math.min(isLighterWeek ? 65 : 70, Math.max(45, Math.round(targetHours * 60 * 0.1)));
    const recentIntervalHints = (recentRows || [])
      .slice(0, 8)
      .map((row) => ((row.summary as { structure_label?: string; short_label?: string } | undefined)?.structure_label || row.summary?.short_label || row.session_type || row.name || '').trim())
      .filter(Boolean);
    const intervalContext = {
      workingThreshold: Number(live?.working_threshold_w || 365),
      repeatabilityDensityLow,
      thresholdNeedsSupport,
      raceSpecificityBias,
      enduranceNeedsSupport,
      taper,
      weekIndex: index,
      prefersVo2Support: /\bvo2\b|max aerobic|aerobic power/i.test(currentDirection),
      recentIntervalHints,
      requestedFocusText: currentDirection,
    };
    const supportWorkout = selectWorkoutFromLibrary({
      weekFocus: weekDecision.focus,
      slot: 'support_primary',
      index: 0,
      context: intervalContext,
      isLighterWeek,
      objective,
      freshnessState: needs.freshnessState,
      eventPressure: needs.eventPressure,
    });
    const qualityOneWorkout = selectWorkoutFromLibrary({
      weekFocus: weekDecision.focus,
      slot: 'quality_primary',
      category: hardOne as PlannerWorkoutCategory,
      index: 1,
      context: intervalContext,
      isLighterWeek,
      objective,
      freshnessState: needs.freshnessState,
      eventPressure: needs.eventPressure,
      alreadyChosenFamilies: supportWorkout.family === 'rest' ? [] : [supportWorkout.family],
    });
    const supportTwoWorkout = selectWorkoutFromLibrary({
      weekFocus: weekDecision.focus,
      slot: 'support_secondary',
      index: 2,
      context: intervalContext,
      isLighterWeek,
      objective,
      freshnessState: needs.freshnessState,
      eventPressure: needs.eventPressure,
      alreadyChosenFamilies: supportWorkout.family === 'rest' ? [] : [supportWorkout.family],
    });
    const qualityTwoWorkout = selectWorkoutFromLibrary({
      weekFocus: weekDecision.focus,
      slot: 'quality_secondary',
      category: hardTwo as PlannerWorkoutCategory,
      index: 3,
      context: intervalContext,
      isLighterWeek,
      objective,
      freshnessState: needs.freshnessState,
      eventPressure: needs.eventPressure,
      alreadyChosenFamilies: [qualityOneWorkout.family].filter((family): family is PlannerWorkoutFamily => family !== 'rest'),
    });
    const longEnduranceWorkout = selectWorkoutFromLibrary({
      weekFocus: weekDecision.focus,
      slot: 'long_endurance',
      index: 4,
      context: intervalContext,
      isLighterWeek,
      objective,
      freshnessState: needs.freshnessState,
      eventPressure: needs.eventPressure,
      alreadyChosenFamilies: [supportWorkout.family, supportTwoWorkout.family].filter((family): family is PlannerWorkoutFamily => family !== 'rest'),
    });
    const restWorkout = selectWorkoutFromLibrary({
      weekFocus: weekDecision.focus,
      slot: 'rest',
      index: 5,
      context: intervalContext,
      isLighterWeek,
      objective,
      freshnessState: needs.freshnessState,
      eventPressure: needs.eventPressure,
    });
    const supportDurationMinutes = supportMinutes;
    const supportTargetLoad = Math.round(supportMinutes * 0.5);
    const supportTwoDurationMinutes = supportTwoWorkout.category === 'recovery' ? Math.max(40, recoveryMinutes) : Math.max(45, recoveryMinutes);
    const supportTwoTargetLoad = supportTwoWorkout.category === 'recovery' ? 25 : 40;
    const qualityOneTargetLoad = qualityOneWorkout.category === 'repeatability' ? (constrained && index === 0 ? 80 : 95) : (constrained && index === 0 ? 80 : 95);
    const qualityTwoTargetLoad = qualityTwoWorkout.category === 'race_like'
      ? (index === 3 ? 70 : 92)
      : weekDecision.focus === 'freshen' && isLighterWeek
        ? 62
        : index === 3
          ? 70
          : 92;
    const longEnduranceTargetLoad = longEnduranceWorkout.label === 'Endurance support' ? 50 : 85;
    const plannedWorkouts = placeWeeklyWorkouts(monday, [
      { date: isoDate(monday), preferredOffset: 0, label: supportWorkout.label, intervalLabel: supportWorkout.intervalLabel, category: supportWorkout.category, durationMinutes: supportDurationMinutes, targetLoad: supportTargetLoad, locked: false },
      { date: isoDate(new Date(monday.getTime() + 86400000)), preferredOffset: 1, label: qualityOneWorkout.label, intervalLabel: qualityOneWorkout.intervalLabel, category: qualityOneWorkout.category, durationMinutes: qualityOneMinutes, targetLoad: qualityOneTargetLoad, locked: false },
      { date: isoDate(new Date(monday.getTime() + 2 * 86400000)), preferredOffset: 2, label: supportTwoWorkout.label, intervalLabel: supportTwoWorkout.intervalLabel, category: supportTwoWorkout.category, durationMinutes: supportTwoDurationMinutes, targetLoad: supportTwoTargetLoad, locked: false },
      { date: isoDate(new Date(monday.getTime() + 4 * 86400000)), preferredOffset: 4, label: qualityTwoWorkout.label, intervalLabel: qualityTwoWorkout.intervalLabel, category: qualityTwoWorkout.category, durationMinutes: qualityTwoMinutes, targetLoad: qualityTwoTargetLoad, locked: false },
      { date: isoDate(new Date(monday.getTime() + 6 * 86400000)), preferredOffset: 6, label: longEnduranceWorkout.label, intervalLabel: longEnduranceWorkout.intervalLabel, category: longEnduranceWorkout.category, durationMinutes: longMinutes, targetLoad: longEnduranceTargetLoad, locked: false },
      { date: isoDate(new Date(monday.getTime() + restOffset * 86400000)), preferredOffset: restOffset, label: restWorkout.label, intervalLabel: restWorkout.intervalLabel, category: restWorkout.category, durationMinutes: 0, targetLoad: 0, locked: false },
      ...(restDaysPerWeek >= 2 ? [{ date: isoDate(new Date(monday.getTime() + extraRestOffset * 86400000)), preferredOffset: extraRestOffset, label: restWorkout.label, intervalLabel: plannedIntervalLabel('rest', 6, intervalContext), category: restWorkout.category, durationMinutes: 0, targetLoad: 0, locked: false }] : []),
    ], { restOffset, longOffset, noBackToBack });
    const workouts = ensureRestDayCount(
      capWorkoutsToTargetHours(
        isCurrentWeek
          ? plannedWorkouts.filter((workout) => workout.date >= planningStartDate)
          : plannedWorkouts,
        targetHours,
      ),
      monday,
      restDaysPerWeek,
      [restOffset, extraRestOffset, (restOffset + 4) % 7, (restOffset + 5) % 7],
    );

    const weekTypeLabel = weekDecision.focus === 'freshen'
      ? 'Lighter week'
      : weekDecision.focus === 'race_specificity'
        ? 'Race-like week'
        : weekDecision.focus === 'threshold_support'
          ? 'Threshold week'
          : 'Repeatability week';
    const intent = weekDecision.focus === 'freshen'
      ? 'Lighter week.'
      : weekDecision.focus === 'race_specificity'
        ? 'Race-like focus.'
        : weekDecision.focus === 'threshold_support'
          ? 'Threshold focus.'
          : 'Repeatability focus.';

    return {
      weekIndex: (index + 1) as 1 | 2 | 3 | 4,
      label,
      intent,
      weekTypeLabel,
      targetHours,
      targetLoad,
      availableHours: remainingWeeklyCap,
      eventHours,
      longSessionDay: preferredLongRideDay.slice(0, 1).toUpperCase() + preferredLongRideDay.slice(1),
      completedThisWeek: index === 0 ? completedThisWeek : [],
      rationale: {
        carriedForward: objective === 'threshold_support'
          ? (thresholdStable ? 'Recent threshold support is stable enough to keep as the primary weekly anchor.' : 'Recent threshold support is not yet stable enough, so the month should rebuild that anchor first.')
          : objective === 'race_specificity'
            ? (raceLikeHits >= 1 ? 'Recent racing-like demand exists, so the month can sharpen it instead of inventing it from zero.' : 'Race-like demand is still light, so one quality day should move closer to race specifics.')
            : repeatabilityReady
              ? 'Recent repeatability has enough density to stay as a true weekly recommendation.'
              : 'Recent repeatability is still thin, so the plan should actively rebuild it instead of assuming it is already there.',
        protected: constrained && index === 0
          ? 'The first planned week is slightly protected because freshness is already constrained.'
          : weekEvents.length
            ? `Planner events consume ${eventHours.toFixed(1)} h this week, so training budget is reduced around ${weekEvents.map((event) => event.title || event.type || 'event').join(', ')}.`
            : noBackToBack
              ? 'Support days stay genuinely supportive and separate the hard recommendations so quality does not leak across the week.'
              : 'Support days still need to stay truly supportive even when back-to-back hard days are allowed.',
        mainAim: objective === 'race_specificity'
          ? `Increase race-like specificity without stacking uncontrolled fatigue${nearGoal ? ' as the goal event approaches.' : '.'}`
          : objective === 'taper'
            ? 'Reduce total cost while keeping the system open for the event.'
            : objective === 'threshold_support'
              ? 'Use current threshold signal, freshness, and recent history to recommend repeatable threshold support rather than generic load.'
              : 'Use goals, current figures, and recent history to recommend track-endurance quality without losing repeatability.',
      },
      workouts,
    };
  });

  return {
    monthStart,
    objective,
    ambition,
    assumptions: {
      goalEvent: live?.goal_race_date ? 'Primary target event detected' : undefined,
      goalDate: live?.goal_race_date,
      ctl,
      atl,
      form,
      recentSummary: buildMonthlyPlannerContextPayload(live, input.currentDirection).recentHistory.keySessions,
      availabilitySummary: buildMonthlyPlannerContextPayload(live, input.currentDirection).availability.summary,
      guardrailSummary: buildMonthlyPlannerContextPayload(live, input.currentDirection).guardrails.summary,
    },
    weeks,
  };
}

export function buildWeeklyDecisionPayload(
  live: LiveState | null | undefined,
  draft: MonthlyPlannerDraftPayload | null | undefined,
  input?: {
    objective?: string;
    ambition?: string;
    currentDirection?: string;
    mustFollow?: { noBackToBackHardDays?: boolean; maxWeeklyHours?: number };
    preferences?: { restDay?: string; restDaysPerWeek?: number; longRideDay?: string };
  },
): WeeklyDecisionPayload {
  const today = live?.today || todayIso();
  const week = currentWeekDraftWeek(draft, today);
  const completedRows = currentWeekCompletedRows(live);
  const completedHours = completedRows.reduce((acc, row) => acc + Number(row.duration_s || 0), 0) / 3600;
  const maxWeeklyHours = Number(input?.mustFollow?.maxWeeklyHours || week?.targetHours || 0);
  const remainingWeekHours = Number(Math.max(0, maxWeeklyHours - completedHours).toFixed(1));
  const completedHard = completedRows.filter((row) => ['repeatability', 'threshold_support', 'race_like'].includes(classifyRecentRow(row))).length;
  const remainingQualityBudget = Math.max(0, 2 - completedHard);
  const focus = (input?.objective === 'race_specificity'
    ? 'race_specificity'
    : input?.objective === 'threshold_support'
      ? 'threshold_support'
      : input?.objective === 'aerobic_support'
        ? 'aerobic_support'
        : Number((live?.wellness?.ctl || 0)) - Number((live?.wellness?.atl || 0)) <= -18
          ? 'unload'
          : 'repeatability') as WeeklyDecisionPayload['focus'];
  const confidence = remainingQualityBudget === 0 ? 'medium' : remainingWeekHours <= 2 ? 'low' : 'high';
  const reasons = [
    `Objective bias: ${input?.objective || draft?.objective || 'repeatability'}.`,
    `Remaining week budget: ${remainingWeekHours.toFixed(1)} h and ${remainingQualityBudget} key slot${remainingQualityBudget === 1 ? '' : 's'}.`,
  ];
  const riskFlags = [
    ...(remainingWeekHours <= 2 ? ['Very little remaining training time this week.'] : []),
    ...((Number((live?.wellness?.ctl || 0)) - Number((live?.wellness?.atl || 0)) <= -12) ? ['Freshness is tightening.'] : []),
  ];
  return { focus, confidence, reasons, riskFlags, remainingWeekHours, remainingQualityBudget };
}

export function buildCurrentWeekReplanPayload(
  live: LiveState | null | undefined,
  draft: MonthlyPlannerDraftPayload | null | undefined,
  input?: Parameters<typeof buildWeeklyDecisionPayload>[2],
): CurrentWeekReplanPayload {
  const today = live?.today || todayIso();
  const week = currentWeekDraftWeek(draft, today);
  const decision = buildWeeklyDecisionPayload(live, draft, input);
  const plannedSoFar = (week?.workouts || []).filter((workout) => workout.date <= today).map(summarizeWorkout);
  const completedSoFar = currentWeekCompletedRows(live).map((row) => summarizeWorkout({
    date: row.start_date_local.slice(0, 10),
    label: row.summary?.short_label || row.session_type || row.name || 'Completed',
    durationMinutes: Math.round(Number(row.duration_s || 0) / 60),
    targetLoad: Math.round(Number(row.training_load || 0)),
  }));
  const missedSessions = plannedSoFar.filter((item) => !completedSoFar.some((done) => done.includes(item.split(' • ')[1] || '')));
  const remainingWorkouts = (week?.workouts || []).filter((workout) => workout.date > today);
  const remainingDays = remainingWorkouts.map((workout) => workout.date);
  const recommendedNextKeyDay = remainingWorkouts.find((workout) => ['repeatability', 'threshold_support', 'race_like'].includes(workout.category))?.date || remainingWorkouts[0]?.date || today;
  const selectedDirectionSummary = input?.currentDirection ? `Selected month direction: ${input.currentDirection}.` : undefined;
  return {
    liveWindowLabel: 'Live active week (today / tomorrow / completed work)',
    draftBridgeLabel: 'Draft bridge (remaining editable slots in this same week)',
    plannedSoFar,
    completedSoFar,
    missedSessions,
    remainingDays,
    recommendedNextKeyDay,
    recommendedFocus: decision.focus,
    recommendationText: `${selectedDirectionSummary ? `${selectedDirectionSummary} ` : ''}${decision.focus.replace('_', ' ')} next. Best key day: ${recommendedNextKeyDay}.`,
    selectedDirectionSummary,
    remainingWeekHours: decision.remainingWeekHours,
    remainingQualityBudget: decision.remainingQualityBudget,
  };
}

export function replanCurrentWeekForScenario(
  live: LiveState | null | undefined,
  draft: MonthlyPlannerDraftPayload | null | undefined,
  input: Parameters<typeof buildWeeklyDecisionPayload>[2],
  scenario: 'missed_session' | 'fatigued' | 'fresher' | 'reduce_load' | 'increase_specificity',
) {
  const week = currentWeekDraftWeek(draft, live?.today || todayIso());
  if (!week) throw new Error('Current week not found');
  const today = live?.today || todayIso();
  const plannedFuture = week.workouts.filter((workout) => workout.date >= today).map((workout) => ({ ...workout }));
  const multiplier = scenario === 'fatigued' || scenario === 'reduce_load' ? 0.85 : scenario === 'fresher' ? 1.05 : 1;
  const workouts = plannedFuture.map((workout, index) => {
    if (scenario === 'increase_specificity' && index === 0 && workout.category !== 'rest') {
      return { ...workout, label: 'Race-like session', category: 'race_like' as const, targetLoad: Math.round(Number(workout.targetLoad || 90) * 1.05) };
    }
    if ((scenario === 'fatigued' || scenario === 'reduce_load') && workout.category !== 'rest') {
      return { ...workout, durationMinutes: workout.durationMinutes ? Math.max(30, Math.round(workout.durationMinutes * multiplier)) : workout.durationMinutes, targetLoad: workout.targetLoad ? Math.max(10, Math.round(workout.targetLoad * multiplier)) : workout.targetLoad };
    }
    if (scenario === 'fresher' && workout.category !== 'rest') {
      return { ...workout, targetLoad: workout.targetLoad ? Math.round(workout.targetLoad * multiplier) : workout.targetLoad };
    }
    return workout;
  });
  return {
    ...week,
    targetHours: scenario === 'fatigued' || scenario === 'reduce_load' ? Number((week.targetHours * 0.9).toFixed(1)) : week.targetHours,
    targetLoad: scenario === 'fatigued' || scenario === 'reduce_load' ? Math.round(week.targetLoad * 0.9) : week.targetLoad,
    completedThisWeek: week.completedThisWeek,
    workouts,
  };
}

export function buildMonthlyPlannerComparePayload(
  live: LiveState | null | undefined,
  draft?: MonthlyPlannerDraftPayload | null,
): MonthlyPlannerComparePayload {
  const recentRows = (live?.recent_rows || []).slice(0, 28);
  const recentWindow = {
    label: 'Recent 4 weeks' as const,
    totalHours: Number((recentRows.reduce((acc, row) => acc + Number(row.duration_s || 0), 0) / 3600).toFixed(1)),
    totalLoad: Math.round(recentRows.reduce((acc, row) => acc + Number(row.training_load || 0), 0)),
    totalSessions: recentRows.length,
  };

  const plannedWorkouts = draft?.weeks.flatMap((week) => week.workouts) || [];
  const draftWindow = {
    label: 'Planned next 4 weeks' as const,
    totalHours: Number((plannedWorkouts.reduce((acc, workout) => acc + Number(workout.durationMinutes || 0), 0) / 60).toFixed(1)),
    totalLoad: Math.round((draft?.weeks.reduce((acc, week) => acc + Number(week.targetLoad || 0), 0)) || plannedWorkouts.reduce((acc, workout) => acc + Number(workout.targetLoad || 0), 0)),
    totalSessions: plannedWorkouts.length,
  };

  const recentCategoryMap: Record<string, MonthlyPlannerComparePayload['categoryComparison'][number]> = {};

  for (const row of recentRows) {
    const category = classifyRecentRow(row);
    recentCategoryMap[category] ||= { category, recentSessions: 0, plannedSessions: 0, deltaSessions: 0, recentHours: 0, plannedHours: 0 };
    recentCategoryMap[category].recentSessions += 1;
    recentCategoryMap[category].recentHours += Number(((row.duration_s || 0) / 3600).toFixed(1));
  }

  for (const workout of plannedWorkouts) {
    const category = workout.category;
    recentCategoryMap[category] ||= { category, recentSessions: 0, plannedSessions: 0, deltaSessions: 0, recentHours: 0, plannedHours: 0 };
    recentCategoryMap[category].plannedSessions += 1;
    recentCategoryMap[category].plannedHours += Number(((workout.durationMinutes || 0) / 60).toFixed(1));
  }

  const categoryComparison = Object.values(recentCategoryMap)
    .map((item) => ({ ...item, deltaSessions: item.plannedSessions - item.recentSessions }))
    .sort((a, b) => b.plannedSessions - a.plannedSessions || b.recentSessions - a.recentSessions);

  const hardCategories = new Set(['repeatability', 'threshold_support', 'race_like']);
  const hardWorkouts = plannedWorkouts
    .filter((workout) => hardCategories.has(workout.category))
    .map((workout) => ({ ...workout, time: new Date(`${workout.date}T00:00:00Z`).getTime() }))
    .sort((a, b) => a.time - b.time);
  const backToBackHardPairs = hardWorkouts.reduce((count, workout, index) => {
    if (!index) return count;
    const prev = hardWorkouts[index - 1]!;
    const daysApart = Math.round((workout.time - prev.time) / 86400000);
    return count + (daysApart <= 1 ? 1 : 0);
  }, 0);

  const freshnessWarnings: string[] = [];
  const loadRatio = recentWindow.totalLoad > 0 ? draftWindow.totalLoad / recentWindow.totalLoad : 1;
  const hoursRatio = recentWindow.totalHours > 0 ? draftWindow.totalHours / recentWindow.totalHours : 1;
  if (loadRatio >= 1.35 || hoursRatio >= 1.3) {
    freshnessWarnings.push(`Freshness risk: planned load jump looks large versus the recent 4 weeks (${draftWindow.totalLoad} vs ${recentWindow.totalLoad} load; ${draftWindow.totalHours.toFixed(1)} vs ${recentWindow.totalHours.toFixed(1)} h).`);
  }
  if (backToBackHardPairs > 0) {
    freshnessWarnings.push(`Freshness risk: the current draft creates ${backToBackHardPairs} back-to-back hard days, which reduces repeatability.`);
  }
  const hardCount = hardWorkouts.length;
  const supportCount = plannedWorkouts.filter((workout) => workout.category === 'endurance' || workout.category === 'recovery' || workout.category === 'rest').length;
  if (hardCount >= 5 && supportCount <= hardCount) {
    freshnessWarnings.push('Freshness risk: quality density is high relative to true support days, so the block may become non-repeatable.');
  }

  const summary = !draft
    ? 'No planned next 4 weeks draft exists yet, so compare view is waiting for a generated block.'
    : `Recent 4 weeks show ${recentWindow.totalHours.toFixed(1)} h and load ${recentWindow.totalLoad}; planned next 4 weeks target ${draftWindow.totalHours.toFixed(1)} h and load ${draftWindow.totalLoad}.`;

  return { recentWindow, draftWindow, categoryComparison, freshnessWarnings, summary };
}

export function buildPlannerWeekPayload(live?: LiveState | null): PlannerWeekPayload {
  const rows = live?.recent_rows || [];
  const completed = rows
    .slice(0, 7)
    .map((row) => latestWorkoutLine(row))
    .filter(Boolean)
    .slice(0, 4);
  const planned = [planLabel(live?.today_plan), planLabel(live?.tomorrow_plan), ...(live?.next_three || []).map((item) => planLabel(item.plan))]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .slice(0, 4);
  const ctl = Number(live?.wellness?.ctl || 0);
  const atl = Number(live?.wellness?.atl || 0);
  const form = ctl - atl;
  const repeatabilityHits = rows.filter((row) => row.session_type === 'broken VO2 / repeatability session').length;
  const thresholdHits = rows.filter((row) => row.session_type === 'threshold / race-support ride').length;
  const longHits = rows.filter((row) => Number(row.duration_s || 0) >= 3 * 3600).length;

  const missingSystems: string[] = [];
  if (!repeatabilityHits) missingSystems.push('No recent repeatability hit logged in the live window.');
  if (!thresholdHits) missingSystems.push('No recent threshold/race-support anchor logged in the live window.');
  if (!longHits) missingSystems.push('No long endurance durability support ride logged in the live window.');
  if (!missingSystems.length) missingSystems.push('No major system is missing in the recent live window; protect freshness and repeatability instead.');

  const riskFlags = [
    form <= -20 ? `Freshness risk is high right now (Form ${form >= 0 ? '+' : ''}${form.toFixed(0)}).` : `Freshness is manageable right now (Form ${form >= 0 ? '+' : ''}${form.toFixed(0)}).`,
    'Planner remains read-only toward Intervals.',
  ];
  if (!live) riskFlags.unshift('No authorized live athlete data is available for this account yet.');

  return {
    weekIntent: !live
      ? 'Connect the correct Intervals athlete first, then keep the week centered on one repeatability anchor, one threshold/race-support anchor, and enough support endurance.'
      : `Keep the week centered on repeatable track-endurance quality while protecting the next decisive session after ${planLabel(live.today_plan)} today and ${planLabel(live.tomorrow_plan)} tomorrow.`,
    keySessionsPlanned: planned.length ? planned : ['Support endurance', 'Repeatability anchor', 'Threshold / race-support anchor'],
    keySessionsCompleted: completed,
    missingSystems,
    fatigueTrend: !live
      ? 'No live CTL/ATL/Form loaded yet for this user.'
      : form <= -20
        ? `Fatigue is carrying high into the week: CTL ${ctl.toFixed(0)}, ATL ${atl.toFixed(0)}, Form ${form >= 0 ? '+' : ''}${form.toFixed(0)}.`
        : `Fatigue is not blocking the week yet: CTL ${ctl.toFixed(0)}, ATL ${atl.toFixed(0)}, Form ${form >= 0 ? '+' : ''}${form.toFixed(0)}.`,
    riskFlags,
  };
}

export function buildPlannerBlockPayload(live?: LiveState | null): PlannerBlockPayload {
  const rows = live?.recent_rows || [];
  const repeatabilityHits = rows.filter((row) => row.session_type === 'broken VO2 / repeatability session').length;
  const thresholdHits = rows.filter((row) => row.session_type === 'threshold / race-support ride').length;
  const raceLikeHits = rows.filter((row) => row.session_type === 'race or race-like stochastic session').length;
  const longHits = rows.filter((row) => Number(row.duration_s || 0) >= 3 * 3600).length;
  const completedPattern = `${repeatabilityHits} repeatability • ${thresholdHits} threshold/race-support • ${raceLikeHits} race-like • ${longHits} long support`;
  const ctl = Number(live?.wellness?.ctl || 0);
  const atl = Number(live?.wellness?.atl || 0);
  const form = ctl - atl;

  return {
    activeBlock: live?.season_phase || 'Current track-endurance block',
    currentWeekWithinBlock: 1,
    mainEmphasis: !live
      ? 'Load the athlete-specific live block first, then bias the block toward repeatability, threshold support, and durability.'
      : `Bias the block toward ${repeatabilityHits ? 'repeatability and race-specificity' : 'restoring repeatability density'} while keeping threshold support repeatable and not stale.`,
    sessionsCompletedAgainstIntendedPattern: completedPattern,
    blockState: !live
      ? 'awaiting_authorized_live_data'
      : form <= -20
        ? 'freshness_constrained_but_salvageable'
        : repeatabilityHits && thresholdHits
          ? 'specific_work_present'
          : 'support_present_but_specific_density_low',
    intervalsPlanWriteState: 'disabled_read_only',
  };
}
