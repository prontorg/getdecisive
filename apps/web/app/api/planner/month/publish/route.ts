import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

import { appRoutes } from '../../../../../lib/routes';
import { getLatestMonthlyPlanDraft, publishMonthlyPlanDraftLocally } from '../../../../../lib/server/planner-customization';
import { captureRouteError, logRouteEvent, redirectWithNotice, routeErrorResponse } from '../../../../../lib/server/route-observability';
import { getSessionUserId } from '../../../../../lib/server/session';

const ROUTE = '/api/planner/month/publish';

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return redirectWithNotice(ROUTE, request, appRoutes.login, { reason: 'no_session' });

  const contentType = request.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const parsed = isJson ? await request.json().catch(() => null) : await request.formData().catch(() => null);
  if (!parsed) return routeErrorResponse(ROUTE, 400, 'Invalid payload', { userId, contentType });

  const draftId = String(parsed instanceof FormData ? parsed.get('draftId') || '' : parsed.draftId || '');
  if (!draftId) return routeErrorResponse(ROUTE, 400, 'Missing draftId', { userId });

  try {
    const draft = await getLatestMonthlyPlanDraft(userId);
    if (!draft || draft.id !== draftId) return routeErrorResponse(ROUTE, 404, 'Draft not found', { userId, draftId });

    const nextDraft = await publishMonthlyPlanDraftLocally(userId, draftId);
    logRouteEvent(ROUTE, 'info', 'Monthly draft published locally', { userId, draftId, isJson });
    revalidatePath(appRoutes.plan);
    if (parsed instanceof FormData) {
      return redirectWithNotice(ROUTE, request, `${appRoutes.plan}?notice=${encodeURIComponent('Draft published locally')}`, { userId, draftId });
    }
    return NextResponse.json(nextDraft);
  } catch (error) {
    const message = captureRouteError(ROUTE, error, { userId, draftId, isJson });
    return routeErrorResponse(ROUTE, 500, message, { userId, draftId, isJson });
  }
}
