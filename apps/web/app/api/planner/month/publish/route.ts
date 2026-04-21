import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { appRoutes } from '../../../../../lib/routes';
import { getLatestMonthlyPlanDraft, publishMonthlyPlanDraftLocally } from '../../../../../lib/server/planner-customization';
import { getSessionUserId } from '../../../../../lib/server/session';

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.redirect(new URL(appRoutes.login, request.url));

  const contentType = request.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const parsed = isJson ? await request.json().catch(() => null) : await request.formData().catch(() => null);
  if (!parsed) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const draftId = String(parsed instanceof FormData ? parsed.get('draftId') || '' : parsed.draftId || '');
  if (!draftId) return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });

  const draft = await getLatestMonthlyPlanDraft(userId);
  if (!draft || draft.id !== draftId) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

  const nextDraft = await publishMonthlyPlanDraftLocally(userId, draftId);
  revalidatePath(appRoutes.plan);
  if (parsed instanceof FormData) {
    return NextResponse.redirect(new URL(appRoutes.plan, request.url));
  }
  return NextResponse.json(nextDraft);
}
