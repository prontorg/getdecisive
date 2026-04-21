import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { appRoutes } from '../../../../../lib/routes';
import { buildGoalPayload, buildMonthlyPlannerDraftPayload } from '../../../../../lib/server/planner-data';
import { getUserGoalEntries, listPlanningEvents, saveMonthlyPlanDraft, saveMonthlyPlanInput } from '../../../../../lib/server/planner-customization';
import { normalizeMonthlyPlanRequestBody } from '../../../../../lib/server/monthly-plan-request';
import { captureRouteError, logRouteEvent, redirectWithNotice, requirePlanningApiAccess, routeErrorResponse } from '../../../../../lib/server/route-observability';
import { getSessionUserId } from '../../../../../lib/server/session';

const ROUTE = '/api/planner/month/draft';

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return redirectWithNotice(ROUTE, request, appRoutes.login, { reason: 'no_session' });

  const planner = await requirePlanningApiAccess(userId, ROUTE);
  if (!planner) return redirectWithNotice(ROUTE, request, appRoutes.onboardingSync, { userId, reason: 'planner_unavailable' });

  const contentType = request.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const parsed = isJson ? await request.json().catch(() => null) : await request.formData().catch(() => null);
  if (!parsed) return routeErrorResponse(ROUTE, 400, 'Invalid payload', { userId, contentType });

  try {
    const monthlyInputs = await saveMonthlyPlanInput(userId, normalizeMonthlyPlanRequestBody(parsed, planner.live?.today || new Date().toISOString().slice(0, 10)));
    const latestInput = monthlyInputs[0];
    const currentDirection = buildGoalPayload(planner.live, await getUserGoalEntries(userId)).goalHistory[0]?.title;
    const planEvents = await listPlanningEvents(userId);
    const generated = buildMonthlyPlannerDraftPayload(planner.live, {
      objective: latestInput?.objective || 'repeatability',
      ambition: latestInput?.ambition || 'balanced',
      currentDirection,
      successMarkers: latestInput?.successMarkers || [],
      mustFollow: {
        noBackToBackHardDays: latestInput?.mustFollow.noBackToBackHardDays,
        maxWeeklyHours: latestInput?.mustFollow.maxWeeklyHours,
      },
      preferences: {
        restDay: latestInput?.preferences.restDay,
        restDaysPerWeek: latestInput?.preferences.restDaysPerWeek,
        longRideDay: latestInput?.preferences.longRideDay,
      },
      planEvents,
    });

    const savedDrafts = await saveMonthlyPlanDraft(userId, {
      monthStart: generated.monthStart,
      inputId: latestInput?.id || 'missing_input',
      assumptions: {
        ...generated.assumptions,
        selectedRecommendationTitle: latestInput?.selectedRecommendation?.title,
        selectedRecommendationObjective: latestInput?.selectedRecommendation?.objective,
        selectedRecommendationReason: latestInput?.selectedRecommendation?.reason,
        selectedRecommendationConfidence: latestInput?.selectedRecommendation?.confidence,
      },
      weeks: generated.weeks.map((week) => ({
        id: `week_${week.weekIndex}`,
        weekIndex: week.weekIndex,
        label: week.label,
        intent: week.intent,
        targetHours: week.targetHours,
        targetLoad: week.targetLoad,
        longSessionDay: week.longSessionDay,
        completedThisWeek: (week.completedThisWeek || []).map((workout, index) => ({
          id: `cw_${week.weekIndex}_${index + 1}`,
          date: workout.date,
          label: workout.label,
          intervalLabel: workout.intervalLabel,
          category: workout.category,
          durationMinutes: workout.durationMinutes,
          targetLoad: workout.targetLoad,
          locked: true,
          source: 'completed',
          status: 'completed',
        })),
        rationale: week.rationale,
        workouts: week.workouts.map((workout, index) => ({
          id: `w_${week.weekIndex}_${index + 1}`,
          date: workout.date,
          label: workout.label,
          intervalLabel: workout.intervalLabel,
          category: workout.category,
          durationMinutes: workout.durationMinutes,
          targetLoad: workout.targetLoad,
          locked: workout.locked,
          source: 'generated',
          status: 'planned',
        })),
      })),
      publishState: 'draft',
    });

    logRouteEvent(ROUTE, 'info', 'Monthly draft generated', {
      userId,
      inputId: latestInput?.id || null,
      draftId: savedDrafts[0]?.id || null,
      monthStart: generated.monthStart,
      isJson,
    });

    revalidatePath(appRoutes.plan);
    revalidatePath(appRoutes.calendar);
    if (parsed instanceof FormData) {
      return redirectWithNotice(ROUTE, request, `${appRoutes.plan}?notice=${encodeURIComponent('Draft generated')}`, {
        userId,
        draftId: savedDrafts[0]?.id || null,
      });
    }
    return NextResponse.json(savedDrafts[0]);
  } catch (error) {
    const message = captureRouteError(ROUTE, error, { userId, isJson });
    return routeErrorResponse(ROUTE, 500, message, { userId, isJson });
  }
}
