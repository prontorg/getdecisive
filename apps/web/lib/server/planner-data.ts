import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

import { appRoutes } from '../routes';
import { loadPlatformState } from './dev-store';
import type { LiveRow, LiveState } from './live-state';
import {
  completeIntervalsSyncJob,
  deriveOnboardingStatus,
  getLatestIntervalsConnection,
  getLatestIntervalsSnapshot,
  getLatestSyncJob,
  getOnboardingRun,
  getUserById,
  type PlatformState,
  type UserRecord,
} from './platform-state';

const execFileAsync = promisify(execFile);
const HERMES_HOME = process.env.HERMES_HOME || '/root/.hermes/profiles/profdecisive';
const DASHBOARD_SCRIPT = `${HERMES_HOME}/scripts/intervals_dashboard.py`;
const COACH_SCRIPT = `${HERMES_HOME}/scripts/intervals_coach.py`;

export type AuthenticatedPlannerContext = {
  state: PlatformState;
  user: UserRecord;
  onboardingState: string;
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

export async function getAuthenticatedPlannerContext(userId: string): Promise<AuthenticatedPlannerContext | null> {
  const state = await loadPlatformState();
  const onboarding = deriveOnboardingStatus(state, userId) || getOnboardingRun(state, userId);
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
  if (!plan || plan === 'Z2 endurance') return 'Support endurance';
  return plan;
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

export async function getLiveIntervalsState(): Promise<LiveState | null> {
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
}

export function authorizeLiveIntervalsState(context: AuthenticatedPlannerContext, live?: LiveState | null): LiveState | null {
  if (!live?.athlete_id) return null;
  const connection = getLatestIntervalsConnection(context.state, context.user.id);
  if (!connection || connection.syncStatus !== 'ready') return null;
  return connection.externalAthleteId === live.athlete_id ? live : null;
}

function getStoredLiveState(context: AuthenticatedPlannerContext): LiveState | null {
  const connection = getLatestIntervalsConnection(context.state, context.user.id);
  if (!connection) return null;
  const snapshot = getLatestIntervalsSnapshot(context.state, context.user.id, connection.id);
  if (!snapshot) return null;
  return authorizeLiveIntervalsState(context, snapshot.liveState);
}

export function resolveAuthorizedLiveState(context: AuthenticatedPlannerContext, sharedLive?: LiveState | null): LiveState | null {
  return getStoredLiveState(context) || authorizeLiveIntervalsState(context, sharedLive);
}

export async function hydrateUserSnapshotFromSharedLive(
  state: PlatformState,
  userId: string,
  sharedLive?: LiveState | null,
): Promise<boolean> {
  const syncJob = getLatestSyncJob(state, userId);
  const connection = syncJob ? state.intervalsConnections.find((item) => item.id === syncJob.connectionId && item.userId === userId) || null : null;
  if (!connection || !syncJob || syncJob.status === 'completed') return false;
  if (getLatestIntervalsSnapshot(state, userId, connection.id)) return false;

  const live = sharedLive ?? await getLiveIntervalsState();
  if (!live?.athlete_id || live.athlete_id !== connection.externalAthleteId) return false;

  completeIntervalsSyncJob(state, syncJob.id, live);
  return true;
}

export async function getAuthorizedPlannerLiveContext(userId: string): Promise<{ context: AuthenticatedPlannerContext; live: LiveState | null } | null> {
  const context = await getAuthenticatedPlannerContext(userId);
  if (!context) return null;
  const live = resolveAuthorizedLiveState(context, await getLiveIntervalsState());
  return { context, live };
}

function recentSessionCounts(rows: LiveRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.session_type || 'Other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
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
      'Use Analysis for the bigger power-profile, goal-alignment, and adaptation picture.',
      avgLongHours < 3 ? 'Reinforce durability support before stacking more sharp work.' : 'Durability support is present enough to let quality stay specific.',
    ],
    analysisViewRoute: appRoutes.analysis,
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
      : form <= -18
        ? 'Keep today supportive or reduce the quality dose.'
        : 'Stay aligned with the planned session, but only if it protects the next decisive quality slot.',
    why: !usingAuthorizedLiveData
      ? `${user.displayName}, live planner data is only shown for the Intervals athlete linked to your own login. Connect your account before using analysis or planning decisions from this view.`
      : form <= -18
        ? 'Freshness is constrained, so preserve the next decisive session rather than chasing the nominal load.'
        : 'Freshness is acceptable enough to respect the plan while still filtering it through recovery and next-session protection.',
    nextToProtect: usingAuthorizedLiveData
      ? 'Protect the next repeatability or threshold anchor instead of leaking load into support days.'
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
