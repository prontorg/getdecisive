import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { appRoutes } from '../../../../../lib/routes';
import { buildGoalPayload, buildMonthlyPlannerDraftPayload } from '../../../../../lib/server/planner-data';
import { getLatestMonthlyPlanDraft, getLatestMonthlyPlanInput, getUserGoalEntries, listPlanningEvents, replaceMonthlyPlanWeek, updateMonthlyPlanWeek } from '../../../../../lib/server/planner-customization';
import { captureRouteError, logRouteEvent, redirectWithNotice, requirePlanningApiAccess, routeErrorResponse } from '../../../../../lib/server/route-observability';
import { getSessionUserId } from '../../../../../lib/server/session';

const ROUTE = '/api/planner/month/week';

function tuneWeekFromAction(
  week: NonNullable<Awaited<ReturnType<typeof getLatestMonthlyPlanDraft>>>['weeks'][number],
  action: string,
) {
  if (action === 'reduce_load') {
    return {
      ...week,
      label: `${week.label} - lighter`,
      targetHours: Number((week.targetHours * 0.9).toFixed(1)),
      targetLoad: Math.max(40, Math.round(week.targetLoad * 0.9)),
      rationale: {
        ...week.rationale,
        protected: 'Load reduced by 10% to preserve freshness and repeatability.',
      },
      workouts: week.workouts.map((workout) => workout.locked ? workout : {
        ...workout,
        targetLoad: workout.targetLoad ? Math.max(10, Math.round(workout.targetLoad * 0.9)) : workout.targetLoad,
        durationMinutes: workout.durationMinutes ? Math.max(40, Math.round(workout.durationMinutes * 0.92)) : workout.durationMinutes,
        source: 'user_modified' as const,
      }),
    };
  }
  if (action === 'increase_specificity') {
    let converted = false;
    return {
      ...week,
      label: `${week.label} - specific`,
      intent: 'Lean this week more clearly toward race-like track-endurance demand.',
      rationale: {
        ...week.rationale,
        mainAim: 'Increase race-like specificity while keeping only two real quality exposures.',
      },
      workouts: week.workouts.map((workout) => {
        if (!converted && !workout.locked && (workout.category === 'threshold_support' || workout.category === 'endurance')) {
          converted = true;
          return {
            ...workout,
            label: 'Race-like session',
            category: 'race_like' as const,
            targetLoad: workout.targetLoad ? Math.round(workout.targetLoad * 1.05) : 90,
            source: 'user_modified' as const,
          };
        }
        return workout;
      }),
    };
  }
  if (action === 'lighter_weekend') {
    return {
      ...week,
      label: `${week.label} - lighter weekend`,
      rationale: {
        ...week.rationale,
        protected: 'Weekend support reduced so freshness stays available for the next quality sequence.',
      },
      workouts: week.workouts.map((workout) => {
        const day = new Date(`${workout.date}T00:00:00Z`).getUTCDay();
        if (workout.locked || (day !== 0 && day !== 6)) return workout;
        return {
          ...workout,
          label: workout.category === 'endurance' ? 'Endurance support' : workout.label,
          targetLoad: workout.targetLoad ? Math.max(10, Math.round(workout.targetLoad * 0.85)) : workout.targetLoad,
          durationMinutes: workout.durationMinutes ? Math.max(50, Math.round(workout.durationMinutes * 0.8)) : workout.durationMinutes,
          source: 'user_modified' as const,
        };
      }),
    };
  }
  return week;
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return redirectWithNotice(ROUTE, request, appRoutes.login, { reason: 'no_session' });

  const planner = await requirePlanningApiAccess(userId, ROUTE);
  if (!planner) return redirectWithNotice(ROUTE, request, appRoutes.onboardingSync, { userId, reason: 'planner_unavailable' });

  const contentType = request.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const parsed = isJson ? await request.json().catch(() => null) : await request.formData().catch(() => null);
  if (!parsed) return routeErrorResponse(ROUTE, 400, 'Invalid payload', { userId, contentType });

  const pick = (key: string) => parsed instanceof FormData ? parsed.get(key) : parsed[key];
  const draftId = String(pick('draftId') || '');
  const weekId = String(pick('weekId') || '');
  const action = String(pick('action') || '');
  if (!draftId || !weekId || !action) return routeErrorResponse(ROUTE, 400, 'Missing identifiers', { userId, draftId, weekId, action });

  try {
    const draft = await getLatestMonthlyPlanDraft(userId);
    const latestInput = await getLatestMonthlyPlanInput(userId);
    const week = draft?.weeks.find((item) => item.id === weekId);
    if (!draft || draft.id !== draftId || !week) return routeErrorResponse(ROUTE, 404, 'Draft or week not found', { userId, draftId, weekId, action });

    let nextDraft = null;
    if (action === 'regenerate') {
      const currentDirection = buildGoalPayload(planner.live, await getUserGoalEntries(userId)).goalHistory[0]?.title;
      const planEvents = await listPlanningEvents(userId);
      const regenerated = buildMonthlyPlannerDraftPayload(planner.live, {
        objective: latestInput?.objective || 'repeatability',
        ambition: latestInput?.ambition || 'balanced',
        currentDirection,
        successMarkers: latestInput?.successMarkers || [],
        mustFollow: {
          noBackToBackHardDays: latestInput?.mustFollow.noBackToBackHardDays,
          maxWeeklyHours: latestInput?.mustFollow.maxWeeklyHours,
        },
        planEvents,
      }).weeks[week.weekIndex - 1];
      if (!regenerated) return routeErrorResponse(ROUTE, 500, 'Could not regenerate week', { userId, draftId, weekId, action });
      nextDraft = await replaceMonthlyPlanWeek(userId, draftId, {
        id: week.id,
        weekIndex: week.weekIndex,
        label: regenerated.label,
        intent: regenerated.intent,
        targetHours: regenerated.targetHours,
        targetLoad: regenerated.targetLoad,
        longSessionDay: regenerated.longSessionDay,
        rationale: regenerated.rationale,
        workouts: regenerated.workouts.map((workout, index) => ({
          id: `${week.id}_regen_${index + 1}`,
          date: workout.date,
          label: workout.label,
          category: workout.category,
          durationMinutes: workout.durationMinutes,
          targetLoad: workout.targetLoad,
          locked: false,
          source: 'generated',
          status: 'planned',
        })),
      });
    } else {
      nextDraft = await updateMonthlyPlanWeek(userId, draftId, weekId, tuneWeekFromAction(week, action));
    }

    logRouteEvent(ROUTE, 'info', 'Week mutation applied', { userId, draftId, weekId, action, isJson });
    revalidatePath(appRoutes.plan);
    if (parsed instanceof FormData) {
      return redirectWithNotice(ROUTE, request, appRoutes.plan, { userId, draftId, weekId, action });
    }
    return NextResponse.json(nextDraft);
  } catch (error) {
    const message = captureRouteError(ROUTE, error, { userId, draftId, weekId, action, isJson });
    return routeErrorResponse(ROUTE, 500, message, { userId, draftId, weekId, action, isJson });
  }
}
