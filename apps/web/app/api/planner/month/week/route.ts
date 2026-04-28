import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { appRoutes } from '../../../../../lib/routes';
import { buildGoalPayload, buildMonthlyPlannerDraftPayload } from '../../../../../lib/server/planner-data';
import { toStoredWeekFromGenerated } from '../../../../../lib/server/monthly-plan-persistence';
import type { MonthlyPlanWeek, MonthlyPlanWorkout } from '../../../../../lib/server/planner-customization';
import { appendMonthlyPlanReconciliationEvent, getLatestMonthlyPlanDraft, getLatestMonthlyPlanInput, getUserGoalEntries, listPlanningEvents, replaceMonthlyPlanWeek, updateMonthlyPlanWeek } from '../../../../../lib/server/planner-customization';
import { captureRouteError, logRouteEvent, redirectWithNotice, requirePlanningApiAccess, routeErrorResponse } from '../../../../../lib/server/route-observability';
import { getSessionUserId } from '../../../../../lib/server/session';

const ROUTE = '/api/planner/month/week';

function tuneWeekFromAction(
  week: MonthlyPlanWeek,
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
            intervalLabel: 'race pace jumps + 4x2min stochastic bridge',
            familyIntent: 'race specific',
            selectionRationale: ['manual_specificity_shift'],
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

function summarizeWeekPreviewWorkout(workout: MonthlyPlanWorkout) {
  const parts = [workout.label || 'Session'];
  if (workout.intervalLabel) parts.push(workout.intervalLabel);
  const metrics = [
    workout.durationMinutes ? `${workout.durationMinutes} min` : null,
    workout.targetLoad ? `${workout.targetLoad} load` : null,
  ].filter(Boolean);
  if (metrics.length) parts.push(metrics.join(' • '));
  return parts.join(' • ');
}

function weekActionTitle(action: string) {
  switch (action) {
    case 'regenerate': return 'Regenerate this week';
    case 'reduce_load': return 'Reduce load this week';
    case 'increase_specificity': return 'Increase specificity this week';
    case 'lighter_weekend': return 'Make weekend lighter';
    default: return action.replace(/_/g, ' ');
  }
}

function weekActionProtectionSummary(action: string, week: MonthlyPlanWeek, nextWeek: MonthlyPlanWeek) {
  const nextKey = nextWeek.workouts.find((workout) => ['repeatability', 'threshold_support', 'race_like'].includes(workout.category));
  const keyDay = nextKey?.date || week.workouts.find((workout) => ['repeatability', 'threshold_support', 'race_like'].includes(workout.category))?.date || 'still resolving';
  switch (action) {
    case 'reduce_load': return `Protects ${keyDay} by trimming surrounding cost before touching the key slot.`;
    case 'increase_specificity': return `Protects ${keyDay} and sharpens one remaining slot toward race demand.`;
    case 'lighter_weekend': return `Protects ${keyDay} by taking support cost out of the weekend instead of the key work.`;
    case 'regenerate': return `Protects ${keyDay} by rebuilding the week from the latest live context and saved month rules.`;
    default: return `Protects ${keyDay} while adjusting the week's structure.`;
  }
}

function weekActionFreshnessSummary(action: string, week: MonthlyPlanWeek, nextWeek: MonthlyPlanWeek) {
  if (nextWeek.targetHours < week.targetHours || nextWeek.targetLoad < week.targetLoad) {
    return 'Freshness cost comes down before apply.';
  }
  if (action === 'increase_specificity') {
    return 'Freshness cost rises slightly, but only around one sharper slot.';
  }
  return 'Freshness cost stays broadly in line with the current saved week.';
}

function buildWeekActionPreview(week: MonthlyPlanWeek, nextWeek: MonthlyPlanWeek, action: string) {
  const changes = nextWeek.workouts.flatMap((afterWorkout, index) => {
    const beforeWorkout = week.workouts.find((candidate) => candidate.id === afterWorkout.id)
      || week.workouts.find((candidate) => candidate.date === afterWorkout.date)
      || week.workouts[index];
    if (!beforeWorkout) return [];
    const before = summarizeWeekPreviewWorkout(beforeWorkout);
    const after = summarizeWeekPreviewWorkout(afterWorkout);
    if (before === after) return [];
    return [{
      date: afterWorkout.date,
      before,
      after,
      beforeIntervalLabel: beforeWorkout.intervalLabel,
      afterIntervalLabel: afterWorkout.intervalLabel,
      beforeFamilyIntent: beforeWorkout.familyIntent,
      afterFamilyIntent: afterWorkout.familyIntent,
      reason: action === 'regenerate'
        ? 'Rebuilt from latest planner inputs and live context.'
        : action === 'reduce_load'
          ? 'Reduced cost while trying to keep the same weekly shape.'
          : action === 'increase_specificity'
            ? 'Pulled the week closer to race-like demand.'
            : 'Reduced support cost later in the week to protect freshness.',
    }];
  }).slice(0, 4);

  return {
    action,
    actionLabel: weekActionTitle(action),
    weekId: week.id,
    weekLabel: week.label,
    summary: action === 'regenerate'
      ? 'Rebuild this week from the latest saved month inputs and live context before applying.'
      : action === 'reduce_load'
        ? 'Cut cost across this week before applying the adjustment.'
        : action === 'increase_specificity'
          ? 'Sharpen one eligible slot before applying the more race-like week.'
          : 'Ease the weekend support load before applying the lighter finish.',
    beforeHours: week.targetHours,
    afterHours: nextWeek.targetHours,
    beforeLoad: week.targetLoad,
    afterLoad: nextWeek.targetLoad,
    keyProtectionSummary: weekActionProtectionSummary(action, week, nextWeek),
    freshnessSummary: weekActionFreshnessSummary(action, week, nextWeek),
    changes,
  };
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
  const intent = String(pick('intent') || (parsed instanceof FormData ? 'apply' : 'apply'));
  if (!draftId || !weekId || !action) return routeErrorResponse(ROUTE, 400, 'Missing identifiers', { userId, draftId, weekId, action, intent });

  try {
    const draft = await getLatestMonthlyPlanDraft(userId);
    const latestInput = await getLatestMonthlyPlanInput(userId);
    const week = draft?.weeks.find((item) => item.id === weekId);
    if (!draft || draft.id !== draftId || !week) return routeErrorResponse(ROUTE, 404, 'Draft or week not found', { userId, draftId, weekId, action });

    let nextWeek: MonthlyPlanWeek | null = null;
    if (action === 'regenerate') {
      const currentDirection = buildGoalPayload(planner.live, await getUserGoalEntries(userId)).goalHistory[0]?.title;
      const planEvents = await listPlanningEvents(userId);
      const regenerated = buildMonthlyPlannerDraftPayload(planner.live, {
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
      }).weeks[week.weekIndex - 1];
      if (!regenerated) return routeErrorResponse(ROUTE, 500, 'Could not regenerate week', { userId, draftId, weekId, action, intent });
      nextWeek = toStoredWeekFromGenerated(regenerated, week);
    } else {
      nextWeek = { ...week, ...tuneWeekFromAction(week, action) };
    }

    if (intent === 'preview') {
      const preview = buildWeekActionPreview(week, nextWeek, action);
      logRouteEvent(ROUTE, 'info', 'Week mutation preview generated', { userId, draftId, weekId, action, intent, isJson });
      return NextResponse.json({ draftId, weekId, action, intent, preview });
    }

    const nextDraft = action === 'regenerate'
      ? await replaceMonthlyPlanWeek(userId, draftId, nextWeek)
      : await updateMonthlyPlanWeek(userId, draftId, weekId, nextWeek);

    logRouteEvent(ROUTE, 'info', 'Week mutation applied', { userId, draftId, weekId, action, isJson });
    await appendMonthlyPlanReconciliationEvent(userId, {
      draftId,
      weekId,
      date: week.workouts[0]?.date || planner.live?.today || new Date().toISOString().slice(0, 10),
      eventType: action === 'regenerate' ? 'week_regenerated' : 'week_replanned',
      title: action === 'regenerate' ? `${week.label} regenerated` : `${week.label} adjusted`,
      detail: action === 'regenerate'
        ? 'Week was regenerated from the latest planner inputs and live context.'
        : `Week mutation applied via ${action}.`,
      source: action === 'regenerate' ? 'planner_runtime' : 'user_action',
    });
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
