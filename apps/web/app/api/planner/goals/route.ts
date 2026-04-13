import { NextResponse } from 'next/server';

import { buildGoalPayload, getAuthenticatedPlannerContext, getLiveIntervalsState } from '../../../../lib/server/planner-data';
import { getUserGoalEntries } from '../../../../lib/server/planner-customization';
import { getSessionUserId } from '../../../../lib/server/session';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const context = await getAuthenticatedPlannerContext(userId);
  if (!context) return NextResponse.json({ error: 'Onboarding incomplete' }, { status: 403 });

  const live = await getLiveIntervalsState();
  const goals = await getUserGoalEntries(userId);
  return NextResponse.json(buildGoalPayload(live, goals));
}
