import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { appRoutes } from '../../../../../lib/routes';
import { replanCurrentWeekForScenario } from '../../../../../lib/server/planner-data';
import { toStoredWeekFromGenerated } from '../../../../../lib/server/monthly-plan-persistence';
import { appendMonthlyPlanReconciliationEvent, getLatestMonthlyPlanDraft, getLatestMonthlyPlanInput, replaceMonthlyPlanWeek } from '../../../../../lib/server/planner-customization';
import { captureRouteError, logRouteEvent, redirectWithNotice, requirePlanningApiAccess, routeErrorResponse } from '../../../../../lib/server/route-observability';
import { getSessionUserId } from '../../../../../lib/server/session';

const ROUTE = '/api/planner/month/replan';

function replanScenarioLabel(scenario: string) {
  switch (scenario) {
    case 'missed_session': return 'Repair missed session';
    case 'fatigued': return 'Too fatigued';
    case 'fresher': return 'Use freshness';
    case 'reduce_load': return 'Cut load';
    case 'increase_specificity': return 'Increase specificity';
    default: return scenario.replace(/_/g, ' ');
  }
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
  const scenario = String(pick('scenario') || '');
  if (!draftId || !scenario) return routeErrorResponse(ROUTE, 400, 'Missing identifiers', { userId, draftId, scenario });

  try {
    const draft = await getLatestMonthlyPlanDraft(userId);
    const latestInput = await getLatestMonthlyPlanInput(userId);
    if (!draft || draft.id !== draftId || !latestInput) return routeErrorResponse(ROUTE, 404, 'Draft or input not found', { userId, draftId, scenario });

    const nextWeek = replanCurrentWeekForScenario(planner.live, {
      monthStart: draft.monthStart,
      objective: latestInput.objective,
      ambition: latestInput.ambition,
      assumptions: {
        ctl: draft.assumptions.ctl || 0,
        atl: draft.assumptions.atl || 0,
        form: draft.assumptions.form || 0,
        recentSummary: draft.assumptions.recentSummary,
        availabilitySummary: draft.assumptions.availabilitySummary,
        guardrailSummary: draft.assumptions.guardrailSummary,
      },
      weeks: draft.weeks,
    }, {
      objective: latestInput.objective,
      ambition: latestInput.ambition,
      currentDirection: undefined,
      mustFollow: {
        noBackToBackHardDays: latestInput.mustFollow.noBackToBackHardDays,
        maxWeeklyHours: latestInput.mustFollow.maxWeeklyHours,
      },
      preferences: {
        restDay: latestInput.preferences.restDay,
        restDaysPerWeek: latestInput.preferences.restDaysPerWeek,
        longRideDay: latestInput.preferences.longRideDay,
      },
    }, scenario as 'missed_session' | 'fatigued' | 'fresher' | 'reduce_load' | 'increase_specificity');

    const existingWeek = draft.weeks.find((week) => week.weekIndex === nextWeek.weekIndex)!;
    const updatedDraft = await replaceMonthlyPlanWeek(userId, draftId, toStoredWeekFromGenerated(nextWeek, existingWeek));

    logRouteEvent(ROUTE, 'info', 'Current-week bridge replanned', {
      userId,
      draftId,
      scenario,
      weekIndex: nextWeek.weekIndex,
      isJson,
    });

    const scenarioLabel = replanScenarioLabel(scenario);

    await appendMonthlyPlanReconciliationEvent(userId, {
      draftId,
      weekId: existingWeek.id,
      date: planner.live?.today || new Date().toISOString().slice(0, 10),
      eventType: 'week_replanned',
      title: `Current week repaired: ${scenarioLabel}`,
      detail: `Current-week runtime repair applied via ${scenarioLabel.toLowerCase()}.`,
      source: 'planner_runtime',
    });

    revalidatePath(appRoutes.plan);
    revalidatePath(appRoutes.calendar);
    if (parsed instanceof FormData) {
      return redirectWithNotice(ROUTE, request, `${appRoutes.plan}?notice=${encodeURIComponent(`Active-week draft bridge updated: ${scenarioLabel}`)}`, {
        userId,
        draftId,
        scenario,
      });
    }
    return NextResponse.json(updatedDraft);
  } catch (error) {
    const message = captureRouteError(ROUTE, error, { userId, draftId, scenario, isJson });
    return routeErrorResponse(ROUTE, 500, message, { userId, draftId, scenario, isJson });
  }
}
