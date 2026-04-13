import { NextResponse } from 'next/server';

import { buildPlannerDayPayload, getAuthenticatedPlannerContext, getLiveIntervalsState } from '../../../../lib/server/planner-data';
import { getSessionUserId } from '../../../../lib/server/session';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const context = await getAuthenticatedPlannerContext(userId);
  if (!context) return NextResponse.json({ error: 'Onboarding incomplete' }, { status: 403 });

  const live = await getLiveIntervalsState();
  return NextResponse.json(buildPlannerDayPayload(context.user, live));
}
