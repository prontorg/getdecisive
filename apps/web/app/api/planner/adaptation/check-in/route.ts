import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { appRoutes } from '../../../../../lib/routes';
import { addUserAdaptationEntry } from '../../../../../lib/server/planner-customization';
import { getAuthenticatedPlannerContext, getLiveIntervalsState } from '../../../../../lib/server/planner-data';
import { getSessionUserId } from '../../../../../lib/server/session';

function deriveStatus(scores: number[], illness: boolean) {
  if (illness) return 'red';
  const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  if (avg >= 4.2) return 'green';
  if (avg >= 3) return 'yellow';
  return 'red';
}

function deriveAction(status: string, illness: boolean) {
  if (illness) return 'Shift to recovery/support only and protect the next decisive quality slot.';
  if (status === 'green') return 'Stay with the planned work if it still protects tomorrow.';
  if (status === 'yellow') return 'Reduce dose, keep quality controlled, and avoid leaking fatigue forward.';
  return 'Strip back to support endurance or full recovery today.';
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.redirect(new URL(appRoutes.login, request.url));

  const context = await getAuthenticatedPlannerContext(userId);
  if (!context) return NextResponse.redirect(new URL(appRoutes.onboardingSync, request.url));

  const formData = await request.formData();
  const live = await getLiveIntervalsState();
  const today = live?.today || new Date().toISOString().slice(0, 10);

  const legs = Number(formData.get('legs') || 3);
  const sleep = Number(formData.get('sleep') || 3);
  const soreness = Number(formData.get('soreness') || 3);
  const motivation = Number(formData.get('motivation') || 3);
  const illness = String(formData.get('illness') || '') === 'on';
  const note = String(formData.get('note') || '').trim();
  const status = deriveStatus([legs, sleep, soreness, motivation], illness);
  const action = deriveAction(status, illness);

  await addUserAdaptationEntry(userId, {
    date: today,
    status,
    legs,
    sleep,
    soreness,
    motivation,
    illness,
    note: note || undefined,
    action,
  });

  revalidatePath(appRoutes.analysis);
  revalidatePath(appRoutes.dashboard);
  revalidatePath(appRoutes.plan);
  return NextResponse.redirect(new URL(appRoutes.analysis, request.url));
}
