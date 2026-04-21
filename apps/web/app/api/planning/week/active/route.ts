import { NextResponse } from 'next/server';

import { ensureCurrentPlanningContext } from '../../../../../lib/server/planning/planning-store';
import { requirePlanningApiAccess, routeErrorResponse } from '../../../../../lib/server/route-observability';
import { getSessionUserId } from '../../../../../lib/server/session';

const ROUTE = '/api/planning/week/active';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return routeErrorResponse(ROUTE, 401, 'Unauthorized');
  const planner = await requirePlanningApiAccess(userId, ROUTE);
  if (!planner) return routeErrorResponse(ROUTE, 403, 'Onboarding incomplete', { userId });

  const { cycle, decision } = await ensureCurrentPlanningContext(userId);

  return NextResponse.json({
    cycle,
    todayDecision: decision,
    today: planner.live?.today || null,
  });
}
