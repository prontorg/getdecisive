import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { appRoutes } from '../../../../../lib/routes';
import {
  getLatestMonthlyPlanDraft,
  lockMonthlyPlanWorkout,
  removeMonthlyPlanWorkout,
  updateMonthlyPlanWorkout,
} from '../../../../../lib/server/planner-customization';
import { captureRouteError, logRouteEvent, redirectWithNotice, routeErrorResponse } from '../../../../../lib/server/route-observability';
import { getSessionUserId } from '../../../../../lib/server/session';

const hardCategories = new Set(['repeatability', 'threshold_support', 'race_like']);
const ROUTE = '/api/planner/month/workout';

function workoutConflictSummary(
  draft: NonNullable<Awaited<ReturnType<typeof getLatestMonthlyPlanDraft>>>,
  workoutId: string,
  moveDate: string,
) {
  const workouts = draft.weeks.flatMap((week) => week.workouts);
  const moving = workouts.find((item) => item.id === workoutId);
  if (!moving) return { sameDayConflict: false, backToBackHard: false, sameDayWorkout: null as typeof moving | null };
  const sameDayWorkout = workouts.find((item) => item.id !== workoutId && item.date === moveDate) || null;
  const movingHard = hardCategories.has(moving.category);
  const adjacentHard = workouts.some((item) => {
    if (item.id === workoutId || !hardCategories.has(item.category)) return false;
    const daysApart = Math.abs(Math.round((new Date(`${item.date}T00:00:00Z`).getTime() - new Date(`${moveDate}T00:00:00Z`).getTime()) / 86400000));
    return daysApart <= 1;
  });
  return {
    sameDayConflict: Boolean(sameDayWorkout),
    backToBackHard: movingHard && adjacentHard,
    sameDayWorkout,
  };
}

function suggestSaferDay(
  draft: NonNullable<Awaited<ReturnType<typeof getLatestMonthlyPlanDraft>>>,
  workoutId: string,
  moveDate: string,
) {
  const base = new Date(`${moveDate}T00:00:00Z`);
  for (const delta of [1, -1, 2, -2, 3, -3]) {
    const next = new Date(base);
    next.setUTCDate(base.getUTCDate() + delta);
    const candidate = next.toISOString().slice(0, 10);
    const conflict = workoutConflictSummary(draft, workoutId, candidate);
    if (!conflict.sameDayConflict && !conflict.backToBackHard) return candidate;
  }
  return null;
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return redirectWithNotice(ROUTE, request, appRoutes.login, { reason: 'no_session' });

  const contentType = request.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const parsed = isJson ? await request.json().catch(() => null) : await request.formData().catch(() => null);
  if (!parsed) return routeErrorResponse(ROUTE, 400, 'Invalid payload', { userId, contentType });

  const pick = (key: string) => parsed instanceof FormData ? parsed.get(key) : parsed[key];
  const draftId = String(pick('draftId') || '');
  const workoutId = String(pick('workoutId') || '');
  const action = String(pick('action') || '');
  if (!draftId || !workoutId || !action) return routeErrorResponse(ROUTE, 400, 'Missing identifiers', { userId, draftId, workoutId, action });

  try {
    const draft = await getLatestMonthlyPlanDraft(userId);
    const workout = draft?.weeks.flatMap((week) => week.workouts).find((item) => item.id === workoutId);
    if (!draft || draft.id !== draftId || !workout) return routeErrorResponse(ROUTE, 404, 'Draft or workout not found', { userId, draftId, workoutId, action });
    if (workout.locked && action !== 'lock') return routeErrorResponse(ROUTE, 409, 'Workout is locked', { userId, draftId, workoutId, action });

    let nextDraft = null;
    if (action === 'lock') {
      nextDraft = await lockMonthlyPlanWorkout(userId, draftId, workoutId, pick('locked') !== 'false' && pick('locked') !== false);
    } else if (action === 'easier') {
      nextDraft = await updateMonthlyPlanWorkout(userId, draftId, workoutId, {
        label: `${workout.label} - easier`,
        targetLoad: workout.targetLoad ? Math.max(10, Math.round(workout.targetLoad * 0.88)) : workout.targetLoad,
        durationMinutes: workout.durationMinutes ? Math.max(40, Math.round(workout.durationMinutes * 0.9)) : workout.durationMinutes,
      });
    } else if (action === 'harder') {
      nextDraft = await updateMonthlyPlanWorkout(userId, draftId, workoutId, {
        label: `${workout.label} - harder`,
        targetLoad: workout.targetLoad ? Math.round(workout.targetLoad * 1.08) : workout.targetLoad,
        durationMinutes: workout.durationMinutes ? Math.round(workout.durationMinutes * 1.05) : workout.durationMinutes,
      });
    } else if (action === 'move_day') {
      const moveDate = String(pick('moveDate') || '');
      if (!moveDate) return routeErrorResponse(ROUTE, 400, 'Missing moveDate', { userId, draftId, workoutId, action });
      const conflict = workoutConflictSummary(draft, workoutId, moveDate);
      if (conflict.sameDayConflict || conflict.backToBackHard) {
        const saferDay = suggestSaferDay(draft, workoutId, moveDate);
        const reasons = [
          conflict.sameDayConflict ? `same-day conflict with ${conflict.sameDayWorkout?.label || 'another workout'}` : null,
          conflict.backToBackHard ? 'back-to-back hard-day conflict' : null,
        ].filter(Boolean).join(' and ');
        if (parsed instanceof FormData) {
          const redirectUrl = new URL(appRoutes.plan, request.url);
          redirectUrl.searchParams.set('moveConflict', workoutId);
          redirectUrl.searchParams.set('moveConflictReason', reasons);
          if (saferDay) redirectUrl.searchParams.set('moveConflictSuggestedDate', saferDay);
          logRouteEvent(ROUTE, 'warn', 'Workout move rejected by conflict checks', { userId, draftId, workoutId, moveDate, reasons, saferDay });
          return NextResponse.redirect(redirectUrl);
        }
        return NextResponse.json({
          error: `Move rejected due to ${reasons}.`,
          code: 'move_conflict',
          suggestedDate: saferDay,
        }, { status: 409 });
      }
      nextDraft = await updateMonthlyPlanWorkout(userId, draftId, workoutId, {
        date: moveDate,
        label: `${workout.label} - moved`,
      });
    } else if (action === 'remove') {
      nextDraft = await removeMonthlyPlanWorkout(userId, draftId, workoutId);
    } else {
      return routeErrorResponse(ROUTE, 400, 'Unsupported action', { userId, draftId, workoutId, action });
    }

    logRouteEvent(ROUTE, 'info', 'Workout mutation applied', { userId, draftId, workoutId, action, isJson });
    revalidatePath(appRoutes.plan);
    if (parsed instanceof FormData) {
      const redirectUrl = new URL(appRoutes.plan, request.url);
      if (action === 'move_day') {
        redirectUrl.searchParams.set('notice', `Workout moved to ${String(pick('moveDate') || '')}`);
      }
      return NextResponse.redirect(redirectUrl);
    }
    if (action === 'move_day') {
      return NextResponse.json({ success: true, notice: `Workout moved to ${String(pick('moveDate') || '')}`, draft: nextDraft });
    }
    return NextResponse.json(nextDraft);
  } catch (error) {
    const message = captureRouteError(ROUTE, error, { userId, draftId, workoutId, action, isJson });
    return routeErrorResponse(ROUTE, 500, message, { userId, draftId, workoutId, action, isJson });
  }
}
