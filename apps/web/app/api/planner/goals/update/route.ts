import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { appRoutes } from '../../../../../lib/routes';
import { addUserGoalEntry } from '../../../../../lib/server/planner-customization';
import { getAuthenticatedPlannerContext } from '../../../../../lib/server/planner-data';
import { getSessionUserId } from '../../../../../lib/server/session';

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.redirect(new URL(appRoutes.login, request.url));

  const context = await getAuthenticatedPlannerContext(userId);
  if (!context) return NextResponse.redirect(new URL(appRoutes.onboardingSync, request.url));

  const formData = await request.formData();
  const title = String(formData.get('title') || '').trim();
  const type = String(formData.get('type') || 'capability_goal').trim();
  const status = String(formData.get('status') || 'active').trim();
  const priority = String(formData.get('priority') || 'support').trim();
  const targetDateRaw = String(formData.get('targetDate') || '').trim();
  const notes = String(formData.get('notes') || '').trim();

  if (title) {
    await addUserGoalEntry(userId, {
      title,
      type,
      status,
      priority: priority === 'A' || priority === 'B' ? priority : 'support',
      targetDate: targetDateRaw || undefined,
      notes: notes || undefined,
    });
  }

  revalidatePath(appRoutes.analysis);
  return NextResponse.redirect(new URL(appRoutes.analysis, request.url));
}
