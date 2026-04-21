import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { appRoutes } from '../../../../../lib/routes';
import { getAuthorizedPlannerLiveContext, replanCurrentWeekForScenario } from '../../../../../lib/server/planner-data';
import { getLatestMonthlyPlanDraft, getLatestMonthlyPlanInput, replaceMonthlyPlanWeek } from '../../../../../lib/server/planner-customization';
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

  const pick = (key: string) => parsed instanceof FormData ? parsed.get(key) : parsed[key];
  const draftId = String(pick('draftId') || '');
  const scenario = String(pick('scenario') || '');
  if (!draftId || !scenario) return NextResponse.json({ error: 'Missing identifiers' }, { status: 400 });

  const draft = await getLatestMonthlyPlanDraft(userId);
  const latestInput = await getLatestMonthlyPlanInput(userId);
  if (!draft || draft.id !== draftId || !latestInput) return NextResponse.json({ error: 'Draft or input not found' }, { status: 404 });

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
  const updatedDraft = await replaceMonthlyPlanWeek(userId, draftId, {
    ...existingWeek,
    ...nextWeek,
    completedThisWeek: (existingWeek.completedThisWeek || []).map((workout, index) => ({
      ...workout,
      id: workout.id || `cw_${existingWeek.weekIndex}_${index + 1}`,
      source: workout.source || 'completed',
      status: workout.status || 'completed',
    })),
    workouts: nextWeek.workouts.map((workout, index) => ({
      ...existingWeek.workouts[index],
      ...workout,
      id: existingWeek.workouts[index]?.id || `${existingWeek.id}_replan_${index + 1}`,
      source: existingWeek.workouts[index]?.source || 'user_modified',
      status: existingWeek.workouts[index]?.status || 'planned',
      locked: existingWeek.workouts[index]?.locked ?? false,
    })),
  });

  revalidatePath(appRoutes.plan);
  revalidatePath(appRoutes.calendar);
  if (parsed instanceof FormData) {
    return NextResponse.redirect(new URL(`${appRoutes.plan}?notice=${encodeURIComponent(`Active-week draft bridge updated: ${scenario}`)}`, request.url));
  }
  return NextResponse.json(updatedDraft);
}
