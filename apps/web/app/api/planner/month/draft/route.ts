import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { appRoutes } from '../../../../../lib/routes';
import { buildGoalPayload, buildMonthlyPlannerDraftPayload } from '../../../../../lib/server/planner-data';
import { toStoredWeekFromGenerated } from '../../../../../lib/server/monthly-plan-persistence';
import { getLatestMonthlyPlanDraft, getLatestMonthlyPlanInput, getUserGoalEntries, listPlanningEvents, saveMonthlyPlanDraft, saveMonthlyPlanInput } from '../../../../../lib/server/planner-customization';
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
    const action = parsed instanceof FormData ? String(parsed.get('action') || '') : String(parsed?.action || '');
    const latestExistingDraft = await getLatestMonthlyPlanDraft(userId);
    const latestInput = action === 'refresh_latest_input'
      ? await getLatestMonthlyPlanInput(userId)
      : (await saveMonthlyPlanInput(userId, normalizeMonthlyPlanRequestBody(parsed, planner.live?.today || new Date().toISOString().slice(0, 10))))[0];
    if (!latestInput) {
      return routeErrorResponse(ROUTE, 404, 'No saved planner inputs found to refresh', { userId, action });
    }
    const currentDirection = buildGoalPayload(planner.live, await getUserGoalEntries(userId)).goalHistory[0]?.title;
    const planEvents = await listPlanningEvents(userId);
    const generated = buildMonthlyPlannerDraftPayload(planner.live, {
      objective: latestInput?.objective || 'repeatability',
      ambition: latestInput?.ambition || 'balanced',
      currentDirection,
      successMarkers: latestInput?.successMarkers || [],
      sourceWindowDays: latestInput?.sourceWindowDays,
      ignoreSickWeek: latestInput?.ignoreSickWeek,
      ignoreVacationWeek: latestInput?.ignoreVacationWeek,
      excludeNonPrimarySport: latestInput?.excludeNonPrimarySport,
      mustFollow: {
        noBackToBackHardDays: latestInput?.mustFollow.noBackToBackHardDays,
        maxWeeklyHours: latestInput?.mustFollow.maxWeeklyHours,
        maxWeekdayMinutes: latestInput?.mustFollow.maxWeekdayMinutes,
        unavailableDates: latestInput?.mustFollow.unavailableDates,
      },
      preferences: {
        restDay: latestInput?.preferences.restDay,
        restDaysPerWeek: latestInput?.preferences.restDaysPerWeek,
        longRideDay: latestInput?.preferences.longRideDay,
      },
      planEvents,
    });

    const savedDrafts = await saveMonthlyPlanDraft(userId, {
      id: latestExistingDraft?.id,
      monthStart: generated.monthStart,
      inputId: latestInput?.id || 'missing_input',
      assumptions: {
        ...generated.assumptions,
        selectedRecommendationTitle: latestInput?.selectedRecommendation?.title,
        selectedRecommendationObjective: latestInput?.selectedRecommendation?.objective,
        selectedRecommendationReason: latestInput?.selectedRecommendation?.reason,
        selectedRecommendationConfidence: latestInput?.selectedRecommendation?.confidence,
      },
      weeks: generated.weeks.map((week) => toStoredWeekFromGenerated(week, latestExistingDraft?.weeks.find((existing) => existing.weekIndex === week.weekIndex))),
      publishState: latestExistingDraft?.publishState === 'published' ? 'published' : 'draft',
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
