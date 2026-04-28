import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { appRoutes } from '../../../../../lib/routes';
import { buildCurrentWeekReplanPayload, replanCurrentWeekForScenario } from '../../../../../lib/server/planner-data';
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

function buildReplanPreviewToken(draftId: string, revision: number, scenario: string, today: string) {
  return `${draftId}:${revision}:${scenario}:${today}`;
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
  const intent = String(pick('intent') || (parsed instanceof FormData ? 'apply' : 'apply'));
  const expectedDraftRevision = Number(pick('expectedDraftRevision') || 0);
  const previewToken = String(pick('previewToken') || '');
  if (!draftId || !scenario) return routeErrorResponse(ROUTE, 400, 'Missing identifiers', { userId, draftId, scenario, intent, expectedDraftRevision, previewToken });

  try {
    const draft = await getLatestMonthlyPlanDraft(userId);
    const latestInput = await getLatestMonthlyPlanInput(userId);
    if (!draft || draft.id !== draftId || !latestInput) return routeErrorResponse(ROUTE, 404, 'Draft or input not found', { userId, draftId, scenario, intent });

    const draftPayload = {
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
    };
    const inputPayload = {
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
    };

    const today = planner.live?.today || new Date().toISOString().slice(0, 10);
    const currentPreviewToken = buildReplanPreviewToken(draft.id, draft.revision || 0, scenario, today);

    if (intent === 'preview') {
      const preview = buildCurrentWeekReplanPayload(planner.live, draftPayload, inputPayload);
      const previewScenario = preview.scenarioPreviews.find((entry) => entry.scenario === scenario) || null;
      logRouteEvent(ROUTE, 'info', 'Current-week repair preview generated', { userId, draftId, scenario, intent, isJson, draftRevision: draft.revision || 0 });
      return NextResponse.json({ draftId, scenario, intent, previewScenario, preview, draftRevision: draft.revision || 0, previewToken: currentPreviewToken, liveSnapshotDate: today });
    }

    if (!expectedDraftRevision || expectedDraftRevision !== (draft.revision || 0) || previewToken !== currentPreviewToken) {
      return routeErrorResponse(ROUTE, 409, 'Repair preview is stale. Refresh the preview before applying.', {
        userId,
        draftId,
        scenario,
        intent,
        expectedDraftRevision,
        currentDraftRevision: draft.revision || 0,
      });
    }

    const nextWeek = replanCurrentWeekForScenario(planner.live, draftPayload, inputPayload, scenario as 'missed_session' | 'fatigued' | 'fresher' | 'reduce_load' | 'increase_specificity');

    const existingWeek = draft.weeks.find((week) => week.weekIndex === nextWeek.weekIndex)!;
    const scenarioLabel = replanScenarioLabel(scenario);
    const matchedPlannedWorkout = existingWeek.workouts.find((workout) => workout.date >= (planner.live?.today || '')) || existingWeek.workouts[0];
    const nextStoredWeek = toStoredWeekFromGenerated(nextWeek, existingWeek);
    nextStoredWeek.workouts = nextStoredWeek.workouts.map((workout) => {
      if (workout.id !== matchedPlannedWorkout?.id) return workout;
      return {
        ...workout,
        matchedPlannedWorkoutId: matchedPlannedWorkout.id,
        matchedPlannedWorkoutLabel: matchedPlannedWorkout.label,
      };
    });
    const updatedDraft = await replaceMonthlyPlanWeek(userId, draftId, nextStoredWeek);

    logRouteEvent(ROUTE, 'info', 'Current-week bridge replanned', {
      userId,
      draftId,
      scenario,
      weekIndex: nextWeek.weekIndex,
      isJson,
    });

    await appendMonthlyPlanReconciliationEvent(userId, {
      draftId,
      weekId: existingWeek.id,
      matchedPlannedWorkoutId: matchedPlannedWorkout?.id,
      matchedPlannedWorkoutLabel: matchedPlannedWorkout?.label,
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
