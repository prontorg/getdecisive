import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { appRoutes } from '../../../../../lib/routes';
import { buildGoalPayload, buildMonthlyPlannerDraftPayload, getAuthorizedPlannerLiveContext } from '../../../../../lib/server/planner-data';
import { getUserGoalEntries, saveMonthlyPlanDraft, saveMonthlyPlanInput } from '../../../../../lib/server/planner-customization';
import { normalizeMonthlyPlanRequestBody } from '../../../../../lib/server/monthly-plan-request';
import { getSessionUserId } from '../../../../../lib/server/session';

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.redirect(new URL(appRoutes.login, request.url));

  const planner = await getAuthorizedPlannerLiveContext(userId);
  if (!planner) return NextResponse.redirect(new URL(appRoutes.onboardingSync, request.url));

  const contentType = request.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const parsed = isJson ? await request.json().catch(() => null) : await request.formData().catch(() => null);
  if (!parsed) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const monthlyInputs = await saveMonthlyPlanInput(userId, normalizeMonthlyPlanRequestBody(parsed, planner.live?.today || new Date().toISOString().slice(0, 10)));

  const latestInput = monthlyInputs[0];
  const currentDirection = buildGoalPayload(planner.live, await getUserGoalEntries(userId)).goalHistory[0]?.title;
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
  });

  const savedDrafts = await saveMonthlyPlanDraft(userId, {
    monthStart: generated.monthStart,
    inputId: latestInput?.id || 'missing_input',
    assumptions: generated.assumptions,
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

  revalidatePath(appRoutes.plan);
  revalidatePath(appRoutes.calendar);
  if (parsed instanceof FormData) {
    return NextResponse.redirect(new URL(`${appRoutes.plan}?notice=${encodeURIComponent('Draft generated')}`, request.url));
  }
  return NextResponse.json(savedDrafts[0]);
}
