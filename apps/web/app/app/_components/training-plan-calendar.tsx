'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Workout = {
  id: string;
  date: string;
  label: string;
  intervalLabel?: string;
  category: 'recovery' | 'endurance' | 'threshold_support' | 'repeatability' | 'race_like' | 'rest';
  durationMinutes?: number;
  targetLoad?: number;
  locked: boolean;
  status: 'planned' | 'published_local' | 'published_intervals' | 'completed';
};

type Week = {
  id: string;
  weekIndex: 1 | 2 | 3 | 4;
  label: string;
  intent?: string;
  targetHours: number;
  targetLoad: number;
  completedThisWeek?: Workout[];
  workouts: Workout[];
};

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

export function TrainingPlanCalendar({ draftId, weeks, today }: { draftId: string; weeks: Week[]; today: string }) {
  const router = useRouter();
  const [draggingWorkoutId, setDraggingWorkoutId] = useState<string | null>(null);
  const [busyDate, setBusyDate] = useState<string | null>(null);

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

  async function moveWorkout(workoutId: string, moveDate: string) {
    if (!workoutId || !moveDate) return;
    setBusyDate(moveDate);
    try {
      const response = await fetch('/api/planner/month/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, workoutId, action: 'move_day', moveDate }),
      });
      router.refresh();
      if (!response.ok) return;
    } finally {
      setBusyDate(null);
      setDraggingWorkoutId(null);
    }
  }

  return (
    <div className="training-plan-review-layout">
      <div className="training-plan-month-grid">
        {calendarDays.map((date) => {
          const dayData = workoutsByDate.get(date) || { completed: [], planned: [], weekIndex: undefined };
          const isPastDay = Boolean(today) && date <= today;
          const plannedForDisplay = isPastDay ? [] : dayData.planned;
          const isRestLike = !dayData.completed.length && !plannedForDisplay.length;
          const isOutsidePlannedRange = !workoutsByDate.has(date);
          return (
            <div
              key={date}
              className={`training-plan-day-card ${isRestLike ? 'rest-day-subtle' : ''} ${isOutsidePlannedRange ? 'training-plan-day-card-empty' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(event) => {
                event.preventDefault();
                const droppedWorkoutId = event.dataTransfer.getData('text/plain') || draggingWorkoutId;
                if (droppedWorkoutId) moveWorkout(droppedWorkoutId, date);
              }}
            >
              <div className="training-plan-day-card__header">
                <strong>{shortDateLabel(date)}</strong>
                <span>{weekdayLabel(date)}</span>
              </div>
              <p className="training-plan-day-card__summary">
                {dayData.completed.length ? `${dayData.completed.length} done` : plannedForDisplay.length ? `${plannedForDisplay.length} planned` : 'Rest'}
              </p>
              <div className="training-plan-day-card__sessions">
                {dayData.completed.map((workout) => (
                  <div key={workout.id} className={`training-plan-session-card training-plan-session-card-completed ${sessionToneClass(workout.category)}`}>
                    <div className="training-plan-session-card__row">
                      <strong className="training-plan-session-card__label">{workout.label}</strong>
                      <span className="training-plan-session-card__tag">done</span>
                    </div>
                    {workout.intervalLabel ? <div className="training-plan-session-card__subhead">{workout.intervalLabel}</div> : null}
                    <div className="training-plan-session-card__meta training-plan-session-card__meta-compact">
                      <span>{workout.durationMinutes || 0}m</span>
                      <span>L{workout.targetLoad || 0}</span>
                    </div>
                  </div>
                ))}
                {plannedForDisplay.map((workout) => (
                  <div
                    key={workout.id}
                    draggable={!workout.locked}
                    onDragStart={(event) => {
                      setDraggingWorkoutId(workout.id);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', workout.id);
                    }}
                    onDragEnd={() => setDraggingWorkoutId(null)}
                    className={`training-plan-session-card ${sessionToneClass(workout.category)} ${busyDate === date ? 'training-plan-session-card-busy' : ''}`}
                  >
                    <div className="training-plan-session-card__row">
                      <strong className="training-plan-session-card__label">{workout.label}</strong>
                      <div className="training-plan-session-card__actions">
                        {workout.locked ? <span className="training-plan-session-card__tag">lock</span> : null}
                        <details className="training-plan-inline-menu">
                          <summary title="Session actions">⋯</summary>
                          <form action="/api/planner/month/workout" method="post" className="training-plan-inline-menu__content">
                            <input type="hidden" name="draftId" value={draftId} />
                            <input type="hidden" name="workoutId" value={workout.id} />
                            <input type="hidden" name="locked" value={workout.locked ? 'false' : 'true'} />
                            <label>
                              <span>Action</span>
                              <select name="action" defaultValue="move_day">
                                <option value="move_day">Move day</option>
                                <option value="easier">Easier</option>
                                <option value="harder">Harder</option>
                                <option value="lock">Lock / unlock</option>
                                <option value="remove">Remove</option>
                              </select>
                            </label>
                            <label>
                              <span>Move day</span>
                              <input type="date" name="moveDate" defaultValue={workout.date} />
                            </label>
                            <button type="submit">Apply</button>
                          </form>
                        </details>
                      </div>
                    </div>
                    {workout.intervalLabel ? <div className="training-plan-session-card__subhead">{workout.intervalLabel}</div> : null}
                    <div className="training-plan-session-card__meta training-plan-session-card__meta-compact">
                      <span>{workout.durationMinutes || 0}m</span>
                      <span>L{workout.targetLoad || 0}</span>
                      <span className="training-plan-session-card__tag">{shortCategoryLabel(workout.category)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <aside className="training-plan-week-summary-column">
        {weeks.map((week) => {
          const completedMinutes = (week.completedThisWeek || []).reduce((acc, workout) => acc + Number(workout.durationMinutes || 0), 0);
          const plannedMinutes = week.workouts.reduce((acc, workout) => acc + Number(workout.durationMinutes || 0), 0);
          const completedLoad = (week.completedThisWeek || []).reduce((acc, workout) => acc + Number(workout.targetLoad || 0), 0);
          const plannedLoad = week.workouts.reduce((acc, workout) => acc + Number(workout.targetLoad || 0), 0);
          const latestHistory = (week.completedThisWeek || []).slice(-1)[0];
          return (
            <div key={week.id} className="training-plan-week-summary-card" style={rowIndexByWeekIndex.get(week.weekIndex) ? { gridRow: rowIndexByWeekIndex.get(week.weekIndex) } : undefined}>
              <div className="training-plan-week-summary-card__inner">
                <div className="training-plan-week-summary-card__kicker">W{week.weekIndex}</div>
                <strong>{week.label}</strong>
                <p>{week.targetHours.toFixed(1)} h • L{week.targetLoad}</p>
                <p>{week.intent || 'Repeatable track-endurance week'}</p>
                <p>{latestHistory ? `History: ${latestHistory.label}` : `Next ${(plannedMinutes / 60).toFixed(1)} h • L${plannedLoad}`}</p>
                <p>{latestHistory ? `${(completedMinutes / 60).toFixed(1)} h done • L${completedLoad}` : `${plannedMinutes ? `${(plannedMinutes / 60).toFixed(1)} h planned • L${plannedLoad}` : 'Fresher week / lower cost'}`}</p>
              </div>
            </div>
          );
        })}
      </aside>
    </div>
  );
}
