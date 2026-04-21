import { NextResponse } from 'next/server';

import { generateAndActivateWeeklyCycle } from '../../../../../lib/server/planning/planning-store';
import { requirePlanningApiAccess, routeErrorResponse } from '../../../../../lib/server/route-observability';
import { getSessionUserId } from '../../../../../lib/server/session';

const ROUTE = '/api/planning/week/generate';

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return routeErrorResponse(ROUTE, 401, 'Unauthorized');
  const planner = await requirePlanningApiAccess(userId, ROUTE);
  if (!planner) return routeErrorResponse(ROUTE, 403, 'Onboarding incomplete', { userId });

  const generated = await generateAndActivateWeeklyCycle(userId);
  if (!generated) return routeErrorResponse(ROUTE, 400, 'Planning context unavailable', { userId, today: planner.live?.today || null });

  return NextResponse.json({
    ...generated,
    today: planner.live?.today || null,
  });
}
