import { NextResponse } from 'next/server';

import { buildGoalPayload, getAuthorizedPlannerLiveContext } from '../../../../lib/server/planner-data';
import { getUserGoalEntries } from '../../../../lib/server/planner-customization';
import { getSessionUserId } from '../../../../lib/server/session';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const planner = await getAuthorizedPlannerLiveContext(userId);
  if (!planner) return NextResponse.json({ error: 'Onboarding incomplete' }, { status: 403 });

  const goals = await getUserGoalEntries(userId);
  return NextResponse.json(buildGoalPayload(planner.live, goals));
}
