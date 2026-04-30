'use client';

import { useEffect, useMemo, useState } from 'react';

type MoveFeedback = {
  workoutId: string;
  requestedDate: string;
  reason: string;
  suggestedDate?: string | null;
};

type SuccessFeedback = {
  title: string;
  detail: string;
};

type NoticeFeedback = {
  title: string;
  detail: string;
  requestedDate?: string;
  suggestedDate?: string | null;
  workoutId?: string;
};

type WeekAction = 'regenerate' | 'reduce_load' | 'increase_specificity' | 'lighter_weekend';

type WeekPreview = {
  action: WeekAction;
  actionLabel: string;
  weekId: string;
  weekLabel: string;
  summary: string;
  beforeHours: number;
  afterHours: number;
  beforeLoad: number;
  afterLoad: number;
  keyProtectionSummary: string;
  freshnessSummary: string;
  changes: Array<{
    date: string;
    before: string;
    after: string;
    beforeIntervalLabel?: string;
    afterIntervalLabel?: string;
    beforeFamilyIntent?: string;
    afterFamilyIntent?: string;
    reason: string;
  }>;
};

type WeekPreviewEnvelope = {
  preview: WeekPreview;
  draftRevision: number;
  previewToken: string;
};

type PlanEvent = {
  id: string;
  title: string;
  date: string;
  type: 'A_race' | 'B_race' | 'C_race' | 'training_camp' | 'travel' | 'blackout';
  priority: 'primary' | 'support' | 'optional';
  durationHours?: number;
};

type ReconciliationAuditEvent = {
  id: string;
  workoutId?: string;
  workoutPlannerSlotId?: string;
  matchedPlannedWorkoutId?: string;
  matchedPlannedWorkoutSlotId?: string;
  matchedPlannedWorkoutLabel?: string;
  completedLabel?: string;
  beforeSummary?: string;
  afterSummary?: string;
  diffSummary?: string;
  scope?: 'workout' | 'week' | 'current_week_runtime';
  eventType: 'workout_skipped' | 'workout_replaced' | 'workout_completed_modified' | 'workout_moved' | 'workout_locked' | 'week_regenerated' | 'week_replanned';
};

type Workout = {
  id: string;
  plannerSlotId?: string;
  date: string;
  label: string;
  intervalLabel?: string;
  familyIntent?: string;
  selectionRationale?: string[];
  category: 'recovery' | 'endurance' | 'threshold_support' | 'repeatability' | 'race_like' | 'rest';
  durationMinutes?: number;
  targetLoad?: number;
  locked: boolean;
  status: 'planned' | 'published_local' | 'published_intervals' | 'completed' | 'skipped' | 'replaced' | 'completed_modified';
  reconciliationNote?: string;
  matchedPlannedWorkoutId?: string;
  matchedPlannedWorkoutLabel?: string;
  completedLabel?: string;
};

type Week = {
  id: string;
  weekIndex: 1 | 2 | 3 | 4;
  label: string;
  intent?: string;
  weekTypeLabel?: string;
  targetHours: number;
  targetLoad: number;
  availableHours?: number;
  eventHours?: number;
  completedThisWeek?: Workout[];
  workouts: Workout[];
};

function weekSummaryLabel(week: Week) {
  return week.weekTypeLabel || week.intent?.replace(/\.$/, '') || 'Repeatable week';
}

function weekVolumeLabel(hours: number, load: number) {
  return `${hours.toFixed(1)} h • L${load}`;
}

function weekSessionCountLabel(count: number) {
  return `${count} ${count === 1 ? 'session' : 'sessions'}`;
}

function shortCategoryLabel(category: Workout['category']) {
  switch (category) {
    case 'threshold_support': return 'threshold';
    case 'repeatability': return 'repeat';
    case 'race_like': return 'race';
    case 'endurance': return 'endurance';
    case 'recovery': return 'recovery';
    case 'rest': return 'rest';
    default: return category;
  }
}

function weekActionButtonLabel(action: WeekAction) {
  switch (action) {
    case 'regenerate': return 'Regenerate';
    case 'reduce_load': return 'Reduce load';
    case 'increase_specificity': return 'Sharpen';
    case 'lighter_weekend': return 'Lighter weekend';
  }
}

function weekActionCompactLabel(action: WeekAction) {
  switch (action) {
    case 'regenerate': return 'Regen';
    case 'reduce_load': return 'Reduce';
    case 'increase_specificity': return 'Sharpen';
    case 'lighter_weekend': return 'Weekend';
  }
}

const WEEK_ACTIONS: WeekAction[] = ['regenerate', 'reduce_load', 'increase_specificity', 'lighter_weekend'];

function familyIntentLabel(workout: Pick<Workout, 'category' | 'label' | 'intervalLabel' | 'familyIntent'>) {
  if (workout.familyIntent) return workout.familyIntent;
  const text = `${workout.label} ${workout.intervalLabel || ''}`.toLowerCase();
  if (/standing-start|torque/.test(text)) return 'standing start';
  if (/sprint primer|neuromuscular sprint/.test(text)) return 'sprint';
  if (/openers/.test(text)) return 'openers';
  if (workout.category === 'threshold_support') return /sweetspot/.test(text) ? 'sweetspot' : /tempo/.test(text) ? 'tempo' : 'threshold';
  if (workout.category === 'repeatability') return /vo2|max aerobic/.test(text) ? 'vo2' : 'repeatability';
  if (workout.category === 'race_like') return /race-pace bridge/.test(text) ? 'race bridge' : 'race specific';
  if (workout.category === 'endurance') return /long endurance/.test(text) ? 'long endurance' : 'endurance';
  if (workout.category === 'recovery') return 'recovery';
  return 'rest';
}

function selectionRationaleLabel(tags?: string[]) {
  if (!tags?.length) return null;
  return tags
    .slice(0, 2)
    .map((tag) => tag.replaceAll('_', ' '))
    .join(' • ');
}

function weekdayLabel(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function shortDateLabel(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}

function shiftDate(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function statusTagLabel(status: Workout['status']) {
  switch (status) {
    case 'completed': return 'done';
    case 'completed_modified': return 'done*';
    case 'skipped': return 'skipped';
    case 'replaced': return 'replaced';
    case 'published_local': return 'local';
    case 'published_intervals': return 'intervals';
    default: return 'planned';
  }
}

function actionSubmitLabel(action: string) {
  switch (action) {
    case 'move_day': return 'Move to day';
    case 'skip': return 'Mark skipped';
    case 'replace_with_support': return 'Replace';
    case 'mark_done_modified': return 'Mark done*';
    case 'remove': return 'Remove';
    default: return 'Apply';
  }
}

function actionSelectionLabel(action: string) {
  switch (action) {
    case 'move_day': return 'Move day';
    case 'skip': return 'Skip';
    case 'replace_with_support': return 'Replace with support';
    case 'mark_done_modified': return 'Mark done*';
    case 'remove': return 'Remove';
    default: return 'Action';
  }
}

const WORKOUT_ACTIONS = ['move_day', 'skip', 'replace_with_support', 'mark_done_modified', 'remove'] as const;

type WorkoutAction = typeof WORKOUT_ACTIONS[number];

function workoutActionState(
  workout: Pick<Workout, 'status'>,
  action: WorkoutAction,
) {
  if (action === 'move_day' || action === 'remove') return 'idle';
  if (action === 'skip') {
    if (workout.status === 'skipped') return 'active';
    if (workout.status === 'replaced' || workout.status === 'completed_modified') return 'disabled';
    return 'idle';
  }
  if (action === 'replace_with_support') {
    if (workout.status === 'replaced') return 'active';
    if (workout.status === 'skipped' || workout.status === 'completed_modified') return 'disabled';
    return 'idle';
  }
  if (workout.status === 'completed_modified') return 'active';
  if (workout.status === 'skipped' || workout.status === 'replaced') return 'disabled';
  return 'idle';
}

function normalizeWorkoutAction(
  workout: Pick<Workout, 'status'>,
  action: string,
) {
  if (!WORKOUT_ACTIONS.includes(action as WorkoutAction)) return 'move_day';
  return workoutActionState(workout, action as WorkoutAction) === 'disabled' ? 'move_day' : action;
}

function shouldCloseMenuAfterSubmit(action: string) {
  return action !== 'move_day';
}

function actionConsequenceHint(action: string) {
  switch (action) {
    case 'replace_with_support':
      return 'Replaces this planned session with a support version in the draft.';
    case 'mark_done_modified':
      return 'Keeps this session on the calendar but marks it done with modifications.';
    case 'remove':
      return 'Removes this planned session from the draft.';
    default:
      return null;
  }
}

function actionPanelContent(action: string) {
  switch (action) {
    case 'move_day':
      return {
        title: 'Move day',
        copy: 'Pick the day that best preserves freshness and key intent.',
        note: 'Server checks still block same-day collisions and back-to-back hard-risk moves.',
      };
    case 'skip':
      return {
        title: 'Skip session',
        copy: 'Use when the planned work should not happen and the draft should reflect that truth.',
      };
    case 'replace_with_support':
      return {
        title: 'Replace with support',
        copy: 'Swap the planned quality for a lower-cost support version while keeping the training signal.',
      };
    case 'mark_done_modified':
      return {
        title: 'Mark done*',
        copy: 'This keeps the day on the calendar but records that execution diverged.',
      };
    case 'remove':
      return {
        title: 'Remove from draft',
        copy: 'This removes the planned session from the draft calendar.',
      };
    default:
      return {
        title: 'Action',
        copy: 'Select the reconciliation path, then confirm.',
      };
  }
}

function actionSuccessNotice(action: string, workout: Pick<Workout, 'label'>) {
  switch (action) {
    case 'remove':
      return {
        title: 'Draft reconciled',
        detail: `Removed ${workout.label} from the draft`,
      };
    case 'skip':
      return {
        title: 'Draft reconciled',
        detail: `Marked ${workout.label} skipped in the draft`,
      };
    case 'replace_with_support':
      return {
        title: 'Draft reconciled',
        detail: `Replaced ${workout.label} with support in the draft`,
      };
    case 'mark_done_modified':
      return {
        title: 'Draft reconciled',
        detail: `Marked ${workout.label} done* in the draft`,
      };
    default:
      return {
        title: 'Planner updated',
        detail: `${workout.label} updated`,
      };
  }
}

function isVisiblePastPlannedWorkout(workout: Workout) {
  return workout.status === 'skipped' || workout.status === 'replaced' || workout.status === 'completed_modified';
}

function statusToneClass(status: Workout['status']) {
  switch (status) {
    case 'skipped': return 'training-plan-session-card-status-skipped';
    case 'replaced': return 'training-plan-session-card-status-replaced';
    case 'completed_modified': return 'training-plan-session-card-status-completed-modified';
    default: return '';
  }
}

function reconciliationAuditLabel(
  workout: Pick<Workout, 'id' | 'plannerSlotId' | 'label' | 'status' | 'matchedPlannedWorkoutLabel' | 'completedLabel'>,
  auditEvent?: ReconciliationAuditEvent,
) {
  const plannedRef = workout.matchedPlannedWorkoutLabel || auditEvent?.matchedPlannedWorkoutLabel || workout.label;
  const completedRef = workout.completedLabel || auditEvent?.completedLabel;
  if (!plannedRef || (workout.status !== 'skipped' && workout.status !== 'replaced' && workout.status !== 'completed_modified')) return null;
  if (workout.status === 'replaced' && plannedRef !== workout.label) {
    return `Planned ref: ${plannedRef}`;
  }
  if (workout.status === 'completed_modified') {
    return completedRef
      ? `Completed as: ${completedRef} • planned ref: ${plannedRef}`
      : `Planned ref: ${plannedRef}`;
  }
  if (workout.status === 'skipped') {
    return `Planned ref: ${plannedRef}`;
  }
  return null;
}

function slotDiffSummary(auditEvent?: ReconciliationAuditEvent) {
  if (!auditEvent) return null;
  if (auditEvent.diffSummary) return auditEvent.diffSummary;
  if (auditEvent.beforeSummary && auditEvent.afterSummary) return `${auditEvent.beforeSummary} → ${auditEvent.afterSummary}`;
  return null;
}

function sessionToneClass(category: Workout['category'] | undefined) {
  switch (category) {
    case 'repeatability': return 'session-tone-repeatability';
    case 'threshold_support': return 'session-tone-threshold';
    case 'race_like': return 'session-tone-race';
    case 'endurance': return 'session-tone-endurance';
    case 'recovery': return 'session-tone-recovery';
    case 'rest': return 'session-tone-rest';
    default: return 'session-tone-default';
  }
}

function planEventBadgeClass(type: PlanEvent['type']) {
  switch (type) {
    case 'A_race': return 'planner-race-badge-a';
    case 'B_race': return 'planner-race-badge-b';
    case 'C_race': return 'planner-race-badge-c';
    case 'blackout': return 'planner-race-badge-blackout';
    default: return 'planner-race-badge-b';
  }
}

export function TrainingPlanCalendar({
  draftId,
  draftRevision,
  weeks: initialWeeks,
  today,
  planEvents = [],
  reconciliationEvents = [],
}: {
  draftId: string;
  draftRevision: number;
  weeks: Week[];
  today: string;
  planEvents?: PlanEvent[];
  reconciliationEvents?: ReconciliationAuditEvent[];
}) {
  const [weeks, setWeeks] = useState<Week[]>(initialWeeks);
  const reconciliationEventByWorkoutId = useMemo(() => {
    const entries = reconciliationEvents
      .filter((event) => event.workoutId || event.matchedPlannedWorkoutId || event.workoutPlannerSlotId || event.matchedPlannedWorkoutSlotId)
      .map((event) => [event.workoutPlannerSlotId || event.matchedPlannedWorkoutSlotId || event.workoutId || event.matchedPlannedWorkoutId!, event] as const);
    return new Map<string, ReconciliationAuditEvent>(entries);
  }, [reconciliationEvents]);
  const reconciliationEventsByWorkoutKey = useMemo(() => {
    const grouped = new Map<string, ReconciliationAuditEvent[]>();
    for (const event of reconciliationEvents) {
      const workoutKey = event.workoutPlannerSlotId || event.matchedPlannedWorkoutSlotId || event.workoutId || event.matchedPlannedWorkoutId;
      if (!workoutKey) continue;
      const current = grouped.get(workoutKey) || [];
      current.push(event);
      grouped.set(workoutKey, current);
    }
    return grouped;
  }, [reconciliationEvents]);
  const [draggingWorkoutId, setDraggingWorkoutId] = useState<string | null>(null);
  const [weekView, setWeekView] = useState(false);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [moveFeedback, setMoveFeedback] = useState<MoveFeedback | null>(null);
  const [successNotice, setSuccessNotice] = useState<SuccessFeedback | null>(null);
  const [menuActionByWorkout, setMenuActionByWorkout] = useState<Record<string, string>>({});
  const [weekPreviewByWeekId, setWeekPreviewByWeekId] = useState<Record<string, WeekPreview | null>>({});
  const [weekPreviewMetaByWeekId, setWeekPreviewMetaByWeekId] = useState<Record<string, { draftRevision: number; previewToken: string } | null>>({});
  const [busyWeekActionByWeekId, setBusyWeekActionByWeekId] = useState<Record<string, WeekAction | null>>({});

  useEffect(() => {
    setWeeks(initialWeeks);
  }, [initialWeeks]);

  const calendarDays = useMemo(() => {
    const dates = new Set<string>();
    for (const week of weeks) {
      for (const workout of week.completedThisWeek || []) dates.add(workout.date);
      for (const workout of week.workouts) dates.add(workout.date);
    }
    const sorted = Array.from(dates).sort();
    if (!sorted.length) return [];
    const first = new Date(`${sorted[0]}T00:00:00Z`);
    const last = new Date(`${sorted[sorted.length - 1]}T00:00:00Z`);
    const firstOffset = (first.getUTCDay() + 6) % 7;
    const lastOffset = 6 - ((last.getUTCDay() + 6) % 7);
    const firstMonday = shiftDate(sorted[0], -firstOffset);
    const lastSunday = shiftDate(sorted[sorted.length - 1], lastOffset);
    const padded: string[] = [];
    for (let cursor = firstMonday; cursor <= lastSunday; cursor = shiftDate(cursor, 1)) padded.push(cursor);
    return padded;
  }, [weeks]);
  const calendarRows = useMemo(() => {
    const rows: string[][] = [];
    for (let index = 0; index < calendarDays.length; index += 7) rows.push(calendarDays.slice(index, index + 7));
    return rows;
  }, [calendarDays]);

  const workoutsByDate = useMemo(() => {
    const map = new Map<string, { completed: Workout[]; planned: Workout[]; weekIndex?: number }>();
    for (const week of weeks) {
      for (const workout of week.completedThisWeek || []) {
        const current = map.get(workout.date) || { completed: [], planned: [], weekIndex: week.weekIndex };
        current.completed.push(workout);
        current.weekIndex = current.weekIndex || week.weekIndex;
        map.set(workout.date, current);
      }
      for (const workout of week.workouts) {
        const current = map.get(workout.date) || { completed: [], planned: [], weekIndex: week.weekIndex };
        current.planned.push(workout);
        current.weekIndex = current.weekIndex || week.weekIndex;
        map.set(workout.date, current);
      }
    }
    return map;
  }, [weeks]);
  const rowIndexByWeekIndex = useMemo(() => {
    const rowMap = new Map<number, number>();
    calendarRows.forEach((row, rowIndex) => {
      for (const date of row) {
        const weekIndex = workoutsByDate.get(date)?.weekIndex;
        if (weekIndex && !rowMap.has(weekIndex)) rowMap.set(weekIndex, rowIndex + 1);
      }
    });
    return rowMap;
  }, [calendarRows, workoutsByDate]);
  const currentWeekRowIndex = useMemo(() => {
    if (!today) return 0;
    const directWeekIndex = workoutsByDate.get(today)?.weekIndex;
    if (directWeekIndex) return rowIndexByWeekIndex.get(directWeekIndex) || 0;
    return calendarRows.findIndex((row) => row.includes(today)) + 1;
  }, [calendarRows, rowIndexByWeekIndex, today, workoutsByDate]);
  const weekRowsToRender = useMemo(() => {
    if (!currentWeekRowIndex) return calendarRows.slice(0, 1);
    return calendarRows.slice(currentWeekRowIndex - 1, currentWeekRowIndex);
  }, [calendarRows, currentWeekRowIndex]);
  const calendarRowsToRender = weekView ? weekRowsToRender : calendarRows;

  const workoutsById = useMemo(() => {
    const map = new Map<string, Workout>();
    for (const week of weeks) {
      for (const workout of week.workouts) map.set(workout.id, workout);
      for (const workout of week.completedThisWeek || []) map.set(workout.id, workout);
    }
    return map;
  }, [weeks]);
  const visiblePlannedWorkoutIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [date, dayData] of workoutsByDate.entries()) {
      const isPastDay = Boolean(today) && date <= today;
      const plannedForDisplay = isPastDay
        ? dayData.planned.filter((workout) => isVisiblePastPlannedWorkout(workout))
        : dayData.planned;
      for (const workout of plannedForDisplay) ids.add(workout.id);
    }
    return ids;
  }, [today, workoutsByDate]);
  const activeNotice = useMemo<NoticeFeedback | null>(() => {
    if (moveFeedback && !visiblePlannedWorkoutIds.has(moveFeedback.workoutId)) {
      return {
        title: 'Move blocked',
        detail: moveFeedback.reason,
        requestedDate: moveFeedback.requestedDate,
        suggestedDate: moveFeedback.suggestedDate,
        workoutId: moveFeedback.workoutId,
      };
    }
    if (successNotice) {
      return {
        title: successNotice.title,
        detail: successNotice.detail,
      };
    }
    return null;
  }, [moveFeedback, successNotice, visiblePlannedWorkoutIds]);
  const planEventsByDate = useMemo(() => {
    const map = new Map<string, PlanEvent[]>();
    for (const event of planEvents) {
      const current = map.get(event.date) || [];
      current.push(event);
      map.set(event.date, current);
    }
    return map;
  }, [planEvents]);

  const hardCategories = new Set<Workout['category']>(['repeatability', 'threshold_support', 'race_like']);

  function dayHint(workoutId: string | null, targetDate: string) {
    if (!workoutId) return null;
    const moving = workoutsById.get(workoutId);
    if (!moving) return null;
    const movingHard = hardCategories.has(moving.category);
    const backToBackHard = movingHard && weeks.some((week) => week.workouts.some((item) => {
      if (item.id === workoutId || !hardCategories.has(item.category)) return false;
      const daysApart = Math.abs(Math.round((new Date(`${item.date}T00:00:00Z`).getTime() - new Date(`${targetDate}T00:00:00Z`).getTime()) / 86400000));
      return daysApart <= 1;
    }));
    if (backToBackHard) return { tone: 'warning' as const, text: 'Back-to-back hard risk' };
    return { tone: 'safe' as const, text: 'Drop looks usable' };
  }

  async function mutateWorkout(workoutId: string, action: 'remove' | 'skip' | 'replace_with_support' | 'mark_done_modified' | 'reset_reconciliation', extra: Record<string, unknown> = {}) {
    const workout = workoutsById.get(workoutId);
    if (!workout) return;
    setSuccessNotice(null);
    setMoveFeedback(null);
    setBusyDate(workout.date);
    try {
      const response = await fetch('/api/planner/month/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, workoutId, plannerSlotId: workout.plannerSlotId, action, ...extra }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMoveFeedback({
          workoutId,
          requestedDate: workout.date,
          reason: payload?.error || `${action} failed. Try again.`,
          suggestedDate: null,
        });
        return;
      }
      const nextNotice = actionSuccessNotice(action, workout);
      if (payload?.weeks) setWeeks(payload.weeks as Week[]);
      setSuccessNotice(nextNotice);
    } finally {
      setBusyDate(null);
    }
  }

  async function moveWorkout(workoutId: string, moveDate: string) {
    if (!workoutId || !moveDate) return;
    setBusyDate(moveDate);
    setSuccessNotice(null);
    try {
      const response = await fetch('/api/planner/month/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, workoutId, plannerSlotId: workoutsById.get(workoutId)?.plannerSlotId, action: 'move_day', moveDate }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409 && payload?.code === 'move_conflict') {
          setMoveFeedback({
            workoutId,
            requestedDate: moveDate,
            reason: payload?.error || 'Move rejected by conflict checks.',
            suggestedDate: payload?.suggestedDate || null,
          });
          return;
        }
        setMoveFeedback({
          workoutId,
          requestedDate: moveDate,
          reason: payload?.error || 'Move failed. Try again.',
          suggestedDate: null,
        });
        return;
      }
      setMoveFeedback(null);
      if (payload?.draft?.weeks) setWeeks(payload.draft.weeks as Week[]);
      setSuccessNotice({
        title: 'Move applied',
        detail: payload?.notice || `Workout moved to ${moveDate}`,
      });
    } finally {
      setBusyDate(null);
      setDraggingWorkoutId(null);
    }
  }

  async function previewWeekAction(weekId: string, action: WeekAction) {
    setBusyWeekActionByWeekId((current) => ({ ...current, [weekId]: action }));
    setSuccessNotice(null);
    try {
      const response = await fetch('/api/planner/month/week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, weekId, action, intent: 'preview' }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.preview) {
        setSuccessNotice({ title: 'Week preview failed', detail: payload?.error || 'Could not preview this week action.' });
        return;
      }
      const previewPayload = payload as WeekPreviewEnvelope;
      setWeekPreviewByWeekId((current) => ({ ...current, [weekId]: previewPayload.preview }));
      setWeekPreviewMetaByWeekId((current) => ({ ...current, [weekId]: { draftRevision: previewPayload.draftRevision, previewToken: previewPayload.previewToken } }));
    } finally {
      setBusyWeekActionByWeekId((current) => ({ ...current, [weekId]: null }));
    }
  }

  async function applyWeekAction(weekId: string, action: WeekAction) {
    const previewMeta = weekPreviewMetaByWeekId[weekId];
    if (!previewMeta) {
      setSuccessNotice({ title: 'Refresh preview first', detail: 'Preview this week change before applying it so the reviewed version is locked in.' });
      return;
    }
    setBusyWeekActionByWeekId((current) => ({ ...current, [weekId]: action }));
    setSuccessNotice(null);
    try {
      const response = await fetch('/api/planner/month/week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, weekId, action, intent: 'apply', expectedDraftRevision: previewMeta.draftRevision, previewToken: previewMeta.previewToken }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setSuccessNotice({ title: 'Week update failed', detail: payload?.error || 'Could not apply this week action.' });
        return;
      }
      if (payload?.weeks) setWeeks(payload.weeks as Week[]);
      setWeekPreviewByWeekId((current) => ({ ...current, [weekId]: null }));
      setWeekPreviewMetaByWeekId((current) => ({ ...current, [weekId]: null }));
      setSuccessNotice({ title: 'Week updated', detail: `${weekActionButtonLabel(action)} applied.` });
    } finally {
      setBusyWeekActionByWeekId((current) => ({ ...current, [weekId]: null }));
    }
  }

  return (
    <div className="training-plan-review-layout training-plan-workspace-calendar-shell">
      <div>
        {activeNotice ? (
          <div className="status-list compact-status-list" style={{ marginBottom: 12 }}>
            <div className="status-item">
              <strong>{activeNotice.title}</strong>
              <p>{activeNotice.detail}</p>
              {activeNotice.requestedDate ? (
                <>
                  <p>Requested day: {activeNotice.requestedDate}</p>
                  {activeNotice.suggestedDate ? (
                    <div className="button-row" style={{ marginTop: 8 }}>
                      <button type="button" onClick={() => moveWorkout(activeNotice.workoutId || '', activeNotice.suggestedDate || '')}>Use suggested day {activeNotice.suggestedDate}</button>
                      <button type="button" className="button-secondary" onClick={() => setMoveFeedback(null)}>Dismiss</button>
                    </div>
                  ) : (
                    <div className="button-row" style={{ marginTop: 8 }}>
                      <button type="button" className="button-secondary" onClick={() => setMoveFeedback(null)}>Dismiss</button>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="training-plan-workspace-calendar-header">
          <div className="kicker">Month workspace</div>
          <strong>Current planning month</strong>
          <p className="training-plan-workspace-calendar-copy">
            {weekView ? 'Only the live week stays in view with its action rail.' : 'Scan the whole month, then tighten a single week when needed.'}
          </p>
          <div className="button-row training-plan-calendar-view-toggle">
            <button type="button" className={!weekView ? 'button-secondary button-link' : 'button-secondary'} onClick={() => setWeekView(false)}>Full month view</button>
            <button type="button" className={weekView ? 'button-secondary button-link' : 'button-secondary'} onClick={() => setWeekView(true)}>Current week view</button>
          </div>
        </div>
      <div className="training-plan-month-grid training-plan-month-grid-compact training-plan-month-grid-premium">
        {calendarRowsToRender.flat().map((date) => {
          const dayData = workoutsByDate.get(date) || { completed: [], planned: [], weekIndex: undefined };
          const isPastDay = Boolean(today) && date <= today;
          const plannedForDisplay = isPastDay ? dayData.planned.filter((workout) => isVisiblePastPlannedWorkout(workout)) : dayData.planned;
          const isRestLike = !dayData.completed.length && !plannedForDisplay.length;
          const isOutsidePlannedRange = !workoutsByDate.has(date);
          const activeHint = dayHint(draggingWorkoutId, date);
          const isHinted = Boolean(draggingWorkoutId) && hoverDate === date && activeHint;
          const planEvents = planEventsByDate.get(date) || [];
          return (
            <div
              key={date}
              className={`training-plan-day-card training-plan-day-card-premium ${isRestLike ? 'rest-day-subtle' : ''} ${isOutsidePlannedRange ? 'training-plan-day-card-empty' : ''} ${isHinted && activeHint?.tone === 'warning' ? 'training-plan-day-card-drop-warning' : ''} ${isHinted && activeHint?.tone === 'safe' ? 'training-plan-day-card-drop-safe' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setHoverDate(date);
                event.dataTransfer.dropEffect = 'move';
              }}
              onDragEnter={() => setHoverDate(date)}
              onDragLeave={() => setHoverDate((current) => (current === date ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setHoverDate(null);
                const droppedWorkoutId = event.dataTransfer.getData('text/plain') || draggingWorkoutId;
                if (droppedWorkoutId) moveWorkout(droppedWorkoutId, date);
              }}
            >
              <div className="training-plan-day-card__header">
                <strong>{shortDateLabel(date)}</strong>
                <span>{weekdayLabel(date)}</span>
              </div>
              {planEvents.length ? (
                <div className="chip-row training-plan-day-card__events">
                  {planEvents.map((event) => (
                    <span key={event.id} className={`chip planner-race-badge ${planEventBadgeClass(event.type)}`}>
                      {event.title}{event.durationHours ? ` • ${event.durationHours}h` : ''}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="training-plan-day-card__summary">
                {dayData.completed.length ? `${dayData.completed.length} done` : plannedForDisplay.length ? `${plannedForDisplay.length} planned` : 'Rest'}
              </p>
              {isHinted && activeHint ? <p className={`training-plan-day-card__drop-hint training-plan-day-card__drop-hint-${activeHint.tone}`}>{activeHint.text}</p> : null}
              <div className="training-plan-day-card__sessions">
                {dayData.completed.map((workout) => {
                  const reconciliationKey = workout.plannerSlotId || workout.id;
                  const reconciliationAudit = reconciliationEventByWorkoutId.get(reconciliationKey) || reconciliationEventByWorkoutId.get(workout.id);
                  const reconciliationAuditText = reconciliationAuditLabel(workout, reconciliationAudit);
                  const changeTrace = slotDiffSummary(reconciliationAudit);
                  return (
                  <div key={workout.id} className={`training-plan-session-card training-plan-session-card-premium training-plan-session-card-completed ${sessionToneClass(workout.category)} ${statusToneClass(workout.status)}`}>
                    <div className="training-plan-session-card__row">
                      <strong className="training-plan-session-card__label">{workout.label}</strong>
                      <span className="training-plan-session-card__tag">{statusTagLabel(workout.status)}</span>
                    </div>
                    {workout.intervalLabel ? <div className="training-plan-session-card__subhead">{workout.intervalLabel}</div> : null}
                    {workout.reconciliationNote ? <div className="training-plan-session-card__subhead">{workout.reconciliationNote}</div> : null}
                    {reconciliationAuditText ? <div className="training-plan-session-card__subhead training-plan-session-card__subhead-audit">{reconciliationAuditText}</div> : null}
                    {changeTrace ? <div className="training-plan-session-card__change-trace"><strong className="training-plan-session-card__change-trace-title">Before → after</strong><span>{changeTrace}</span></div> : null}
                    <div className="training-plan-session-card__meta training-plan-session-card__meta-compact">
                      <span>{workout.durationMinutes || 0}m</span>
                      <span>L{workout.targetLoad || 0}</span>
                    </div>
                  </div>
                )})}
                {plannedForDisplay.map((workout) => {
                  const inlineMoveFeedback = moveFeedback?.workoutId === workout.id ? moveFeedback : null;
                  const reconciliationKey = workout.plannerSlotId || workout.id;
                  const reconciliationAudit = reconciliationEventByWorkoutId.get(reconciliationKey) || reconciliationEventByWorkoutId.get(workout.id);
                  const workoutAuditTrail = reconciliationEventsByWorkoutKey.get(reconciliationKey) || [];
                  const reconciliationAuditText = reconciliationAuditLabel(workout, reconciliationAudit);
                  const changeTrace = slotDiffSummary(reconciliationAudit);
                  const selectedAction = normalizeWorkoutAction(workout, menuActionByWorkout[workout.id] || 'move_day');
                  const busyWorkout = busyDate === date;
                  const showMoveDateField = selectedAction === 'move_day';
                  const submitLabel = actionSubmitLabel(selectedAction);
                  const closeMenuAfterSubmit = shouldCloseMenuAfterSubmit(selectedAction);
                  const destructiveActionSelected = selectedAction === 'remove';
                  const actionHint = actionConsequenceHint(selectedAction);
                  const actionHintClassName = destructiveActionSelected
                    ? 'training-plan-inline-menu__danger-hint'
                    : 'training-plan-inline-menu__action-hint';
                  const panel = actionPanelContent(selectedAction);
                  return (
                  <div
                    key={workout.id}
                    className={`training-plan-session-card training-plan-session-card-premium ${sessionToneClass(workout.category)} ${statusToneClass(workout.status)} ${busyWorkout ? 'training-plan-session-card-busy' : ''}`}
                  >
                    <div className="training-plan-session-card__row">
                      <strong className="training-plan-session-card__label">{workout.label}</strong>
                      <div className="training-plan-session-card__actions">
                        {!workout.locked ? (
                          <span
                            draggable
                            className="training-plan-session-card__drag-handle"
                            title="Drag to move this session"
                            aria-label="Drag to move this session"
                            onDragStart={(event) => {
                              const workoutIdentity = workout.plannerSlotId || workout.id;
                              setDraggingWorkoutId(workoutIdentity);
                              setHoverDate(null);
                              event.dataTransfer.effectAllowed = 'move';
                              event.dataTransfer.setData('text/plain', workoutIdentity);
                            }}
                            onDragEnd={() => {
                              setDraggingWorkoutId(null);
                              setHoverDate(null);
                            }}
                          >
                            ⋮⋮
                          </span>
                        ) : null}
                        {workout.locked ? <span className="training-plan-session-card__tag">lock</span> : null}
                        {workout.status !== 'planned' ? <span className="training-plan-session-card__tag">{statusTagLabel(workout.status)}</span> : null}
                        <details className="training-plan-inline-menu">
                          <summary title="Session actions">⋯</summary>
                          <form
                            action="/api/planner/month/workout"
                            method="post"
                            className="training-plan-inline-menu__content"
                            onSubmit={(event) => {
                              if (!closeMenuAfterSubmit) return;
                              const details = event.currentTarget.closest('details');
                              if (details instanceof HTMLDetailsElement) details.open = false;
                            }}
                          >
                            <input type="hidden" name="draftId" value={draftId} />
                            <input type="hidden" name="workoutId" value={workout.id} />
                            <div className="training-plan-inline-menu__action-list">
                              {WORKOUT_ACTIONS.map((action) => {
                                const actionActive = selectedAction === action;
                                const actionDanger = action === 'remove';
                                const actionState = workoutActionState(workout, action);
                                const actionDisabled = busyWorkout || actionState === 'disabled';
                                const actionPillClassName = [
                                  'button-secondary',
                                  'training-plan-inline-menu__action-pill',
                                  actionActive ? 'training-plan-inline-menu__action-pill-active' : '',
                                  actionDanger ? 'training-plan-inline-menu__action-pill-danger' : '',
                                ].filter(Boolean).join(' ');
                                return (
                                  <button
                                    key={action}
                                    type="button"
                                    className={actionPillClassName}
                                    aria-pressed={actionActive ? 'true' : 'false'}
                                    disabled={actionDisabled}
                                    aria-disabled={actionDisabled}
                                    onClick={() => {
                                      if (actionDisabled) return;
                                      setMenuActionByWorkout((current) => ({
                                        ...current,
                                        [workout.id]: action,
                                      }));
                                    }}
                                  >
                                    {actionSelectionLabel(action)}
                                  </button>
                                );
                              })}
                              {workout.status !== 'planned' ? (
                                <button
                                  type="button"
                                  className="button-secondary training-plan-inline-menu__action-pill"
                                  disabled={busyWorkout}
                                  aria-disabled={busyWorkout}
                                  onClick={() => {
                                    if (busyWorkout) return;
                                    mutateWorkout(workout.id, 'reset_reconciliation');
                                  }}
                                >
                                  Undo
                                </button>
                              ) : null}
                            </div>
                            <input type="hidden" name="action" value={selectedAction} />
                            <div className="training-plan-inline-menu__selected-action-row">
                              <span className="training-plan-inline-menu__selected-action-label">Selected</span>
                              <span className="training-plan-session-card__tag">{actionSelectionLabel(selectedAction)}</span>
                            </div>
                            <div className="training-plan-inline-menu__action-summary">
                              <strong className="training-plan-inline-menu__panel-title">{panel.title}</strong>
                              <p className="training-plan-inline-menu__panel-copy">{panel.copy}</p>
                            </div>
                            {showMoveDateField ? (
                              <label>
                                <span>Move day</span>
                                <input type="date" name="moveDate" defaultValue={workout.date} />
                              </label>
                            ) : null}
                            {showMoveDateField ? (
                              <p className="training-plan-inline-menu__move-note">{panel.note}</p>
                            ) : null}
                            {actionHint ? (
                              <p className={actionHintClassName}>{actionHint}</p>
                            ) : null}
                            <button
                              type="submit"
                              className={destructiveActionSelected ? 'training-plan-inline-menu__submit-danger' : undefined}
                            >
                              {submitLabel}
                            </button>
                          </form>
                        </details>
                      </div>
                    </div>
                    {workout.intervalLabel ? <div className="training-plan-session-card__subhead">{workout.intervalLabel}</div> : null}
                    {workout.reconciliationNote ? <div className="training-plan-session-card__subhead">{workout.reconciliationNote}</div> : null}
                    {reconciliationAuditText ? <div className="training-plan-session-card__subhead training-plan-session-card__subhead-audit">{reconciliationAuditText}</div> : null}
                    {changeTrace ? <div className="training-plan-session-card__change-trace"><strong className="training-plan-session-card__change-trace-title">Before → after</strong><span>{changeTrace}</span></div> : null}
                    {workoutAuditTrail.length > 1 ? <div className="training-plan-session-card__change-trace"><strong className="training-plan-session-card__change-trace-title">Change trace</strong><span>{workoutAuditTrail.length} linked events recorded for this slot.</span></div> : null}
                    {inlineMoveFeedback ? (
                      <div className="training-plan-session-card__inline-feedback">
                        <strong>Move blocked</strong>
                        <p>{inlineMoveFeedback.reason}</p>
                        <p>Requested day: {inlineMoveFeedback.requestedDate}</p>
                        {inlineMoveFeedback.suggestedDate ? (
                          <div className="button-row training-plan-session-card__inline-feedback-actions">
                            <button type="button" className="button-secondary" onClick={() => moveWorkout(workout.id, inlineMoveFeedback.suggestedDate || '')}>Use suggested day {inlineMoveFeedback.suggestedDate}</button>
                            <button type="button" className="button-secondary" onClick={() => setMoveFeedback(null)}>Dismiss</button>
                          </div>
                        ) : (
                          <div className="button-row training-plan-session-card__inline-feedback-actions">
                            <button type="button" className="button-secondary" onClick={() => setMoveFeedback(null)}>Dismiss</button>
                          </div>
                        )}
                      </div>
                    ) : null}
                    <div className="training-plan-session-card__meta training-plan-session-card__meta-compact">
                      <span>{workout.durationMinutes || 0}m</span>
                      <span>L{workout.targetLoad || 0}</span>
                      <span className="training-plan-session-card__tag training-plan-session-card__tag-family" title={selectionRationaleLabel(workout.selectionRationale) || undefined}>{familyIntentLabel(workout)}</span>
                      <span className="training-plan-session-card__tag">{shortCategoryLabel(workout.category)}</span>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      </div>

      <aside className="training-plan-week-summary-column training-plan-workspace-week-rail">
        <div className="training-plan-week-summary-column-header">
          <span className="training-plan-week-summary-column__eyebrow">{weekView ? 'Current week focus' : 'Month overview'}</span>
          <strong>{weekView ? 'Current week action rail' : 'Week summaries'}</strong>
          <p>{weekView ? 'Only the live week stays in view with its action rail.' : 'Scan the whole month, then tighten a single week when needed.'}</p>
        </div>
        {(weekView
          ? weeks.filter((week) => rowIndexByWeekIndex.get(week.weekIndex) === currentWeekRowIndex)
          : weeks
        ).map((week) => {
          const completedMinutes = (week.completedThisWeek || []).reduce((acc, workout) => acc + Number(workout.durationMinutes || 0), 0);
          const plannedMinutes = week.workouts.reduce((acc, workout) => acc + Number(workout.durationMinutes || 0), 0);
          const completedLoad = (week.completedThisWeek || []).reduce((acc, workout) => acc + Number(workout.targetLoad || 0), 0);
          const plannedLoad = week.workouts.reduce((acc, workout) => acc + Number(workout.targetLoad || 0), 0);
          const completedCount = (week.completedThisWeek || []).length;
          const plannedCount = week.workouts.length;
          const summaryLabel = weekSummaryLabel(week);
          const availableHoursLabel = typeof week.availableHours === 'number'
            ? `${week.availableHours.toFixed(1)} h available`
            : `${week.targetHours.toFixed(1)} h available`;
          const eventAdjustedHoursLabel = typeof week.eventHours === 'number' && week.eventHours > 0
            ? `${availableHoursLabel} after ${week.eventHours.toFixed(1)} h events`
            : availableHoursLabel;
          const weekPreview = weekPreviewByWeekId[week.id] || null;
          const busyWeekAction = busyWeekActionByWeekId[week.id] || null;
          return (
            <div key={week.id} className="training-plan-week-summary-card training-plan-week-summary-card-premium" style={rowIndexByWeekIndex.get(week.weekIndex) ? { gridRow: rowIndexByWeekIndex.get(week.weekIndex) } : undefined}>
              <div className="training-plan-week-summary-card__inner">
                <div className="training-plan-week-summary-card__header">
                  <div>
                    <div className="training-plan-week-summary-card__kicker">W{week.weekIndex}</div>
                    <strong>{week.label}</strong>
                  </div>
                  <span className="training-plan-week-summary-card__badge">{weekView ? 'Live week' : summaryLabel}</span>
                </div>
                <p className="training-plan-week-summary-card__intent">{summaryLabel}</p>
                <div className="training-plan-week-summary-card__stats">
                  <div className="training-plan-week-summary-card__stat">
                    <span className="training-plan-week-summary-card__stat-label">Target</span>
                    <strong>{weekVolumeLabel(week.targetHours, week.targetLoad)}</strong>
                    <span>{eventAdjustedHoursLabel}</span>
                  </div>
                  <div className="training-plan-week-summary-card__stat">
                    <span className="training-plan-week-summary-card__stat-label">Done</span>
                    <strong>{weekVolumeLabel(completedMinutes / 60, completedLoad)}</strong>
                    <span>{weekSessionCountLabel(completedCount)}</span>
                  </div>
                  <div className="training-plan-week-summary-card__stat">
                    <span className="training-plan-week-summary-card__stat-label">Planned</span>
                    <strong>{weekVolumeLabel(plannedMinutes / 60, plannedLoad)}</strong>
                    <span>{weekSessionCountLabel(plannedCount)}</span>
                  </div>
                </div>
                <div className="training-plan-week-summary-card__actions">
                  {WEEK_ACTIONS.map((action) => (
                    <button
                      key={action}
                      type="button"
                      className="button-secondary"
                      disabled={Boolean(busyWeekAction)}
                      onClick={() => previewWeekAction(week.id, action)}
                    >
                      {weekActionCompactLabel(action)}
                    </button>
                  ))}
                </div>
                {weekPreview ? (
                  <div className="training-plan-week-summary-preview status-item">
                    <strong>{weekPreview.actionLabel}</strong>
                    <p>{weekPreview.summary}</p>
                    <span>{weekPreview.beforeHours.toFixed(1)} h / L{weekPreview.beforeLoad} → {weekPreview.afterHours.toFixed(1)} h / L{weekPreview.afterLoad}</span>
                    <span>{weekPreview.keyProtectionSummary}</span>
                    <span>{weekPreview.freshnessSummary}</span>
                    {weekPreview.changes.map((change) => (
                      <div key={`${weekPreview.weekId}-${weekPreview.action}-${change.date}-${change.after}`} className="training-plan-current-week-panel__change-row">
                        <strong>{change.date}</strong>
                        <p>{change.before}</p>
                        {change.beforeIntervalLabel ? <span>Before structure: {change.beforeIntervalLabel}</span> : null}
                        {change.beforeFamilyIntent ? <span>Before intent: {change.beforeFamilyIntent}</span> : null}
                        <p>→ {change.after}</p>
                        {change.afterIntervalLabel ? <span>After structure: {change.afterIntervalLabel}</span> : null}
                        {change.afterFamilyIntent ? <span>After intent: {change.afterFamilyIntent}</span> : null}
                        <span>{change.reason}</span>
                      </div>
                    ))}
                    <div className="button-row" style={{ marginTop: 8 }}>
                      <button type="button" className="button-secondary button-link" disabled={Boolean(busyWeekAction)} onClick={() => applyWeekAction(week.id, weekPreview.action)}>Apply week change</button>
                      <button type="button" className="button-secondary" disabled={Boolean(busyWeekAction)} onClick={() => setWeekPreviewByWeekId((current) => ({ ...current, [week.id]: null }))}>Dismiss</button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </aside>
    </div>
  );
}
