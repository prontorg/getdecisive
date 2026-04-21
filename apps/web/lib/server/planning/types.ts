import type { LiveRow, LiveState } from '../live-state';

export type PlanningCycleStatus = 'draft' | 'active' | 'superseded';
export type PlanningGenerationReason = 'scheduled_weekly' | 'manual_regenerate' | 'major_context_change';
export type PlannedType = 'rest' | 'recovery' | 'endurance' | 'threshold_support' | 'repeatability' | 'race_like' | 'sharpness';
export type PlanningPriority = 'key' | 'support' | 'optional';
export type MissedPolicy = 'move' | 'downgrade' | 'skip';
export type PlanningDayStatus = 'planned' | 'done' | 'adapted' | 'skipped' | 'moved';
export type PlanningConfidence = 'high' | 'medium' | 'low';
export type PlanningPhaseType = 'build' | 'absorb' | 'taper' | 'race_week' | 'rebuild';

export type StablePlanningContext = {
  disciplineFocus: 'track_endurance' | 'road_support';
  roadSupportRole?: 'secondary' | 'equal';
  thresholdAnchorW?: number;
  raceSupportBandW?: { min: number; max: number };
  strengths?: string[];
  limiters?: string[];
  blankDayDefault: 'support_endurance' | 'rest';
  preferredRestDay?: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  preferredLongRideDay?: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  gymDays?: string[];
  maxWeeklyHours?: number;
  hardDaysMaxPerWeek?: number;
  noBackToBackHardDays?: boolean;
};

export type PlanningGoalContext = {
  currentDirection?: string;
  keyEventTitle?: string;
  keyEventDate?: string;
  currentBlockObjective?: string;
  currentPhase?: string;
  successMarkers?: string[];
};

export type PlanningLiveContext = {
  today: string;
  ctl: number;
  atl: number;
  form: number;
  goalRaceDate?: string;
  recentRows: LiveRow[];
  currentWeekCompletedRows: LiveRow[];
  recentSessionCounts: Record<string, number>;
  freshnessBand: 'heavy_fatigue' | 'manageable_fatigue' | 'neutral' | 'fresh';
  sourceLiveState?: LiveState;
};

export type PlanningExecutionContext = {
  completedSessionCount: number;
  completedLoad: number;
  completedTypes: PlannedType[];
  missedKeySessions: number;
};

export type PlanningInputSnapshot = {
  id: string;
  athleteId: string;
  capturedAt: string;
  athleteContext: StablePlanningContext;
  goalContext: PlanningGoalContext;
  liveContext: PlanningLiveContext;
  executionContext: PlanningExecutionContext;
};

export type PlanningDay = {
  id: string;
  athleteId: string;
  planningCycleId: string;
  date: string;
  plannedType: PlannedType;
  plannedLabel: string;
  plannedStructure?: string;
  plannedDurationMin?: number;
  plannedDurationMax?: number;
  plannedLoadMin?: number;
  plannedLoadMax?: number;
  priority: PlanningPriority;
  ifMissedPolicy: MissedPolicy;
  fallbackIfFatigued: string;
  upgradeIfFresh?: string;
  rationale: string;
  status: PlanningDayStatus;
};

export type PlanningCycle = {
  id: string;
  athleteId: string;
  sourceSnapshotId: string;
  createdAt: string;
  validFrom: string;
  validTo: string;
  status: PlanningCycleStatus;
  generationReason: PlanningGenerationReason;
  primaryFocus: string;
  secondaryFocus?: string;
  phaseType: PlanningPhaseType;
  freshnessTarget: string;
  specificityTarget: string;
  confidence: PlanningConfidence;
  rationale: string[];
  risks: string[];
  supersededBy?: string;
  days: PlanningDay[];
};

export type DailyDecision = {
  id: string;
  athleteId: string;
  planningCycleId: string;
  sourceSnapshotId: string;
  createdAt: string;
  decisionDate: string;
  plannedForToday: string;
  actualRecommendationForToday: string;
  plannedForTomorrow: string;
  likelyTomorrowAfterToday: string;
  recommendedNextKeyDay?: string;
  confidence: PlanningConfidence;
  reasonSummary: string;
  decisionBasis: {
    freshness: string;
    completedWork: string;
    missedWork: string;
    raceDirection: string;
    weeklyBalance: string;
  };
  risks: string[];
};

export type PlanningEvent = {
  id: string;
  athleteId: string;
  planningCycleId: string;
  planningDayId?: string;
  eventType: 'cycle_generated' | 'decision_generated' | 'session_moved' | 'session_downgraded' | 'session_skipped' | 'cycle_superseded';
  createdAt: string;
  summary: string;
  payload?: Record<string, unknown>;
};
