import { NextResponse } from 'next/server';

import { buildAdaptationPayload, authorizeLiveIntervalsState, getAuthenticatedPlannerContext, getLiveIntervalsState } from '../../../../lib/server/planner-data';
import { getUserAdaptationEntries } from '../../../../lib/server/planner-customization';
import { getSessionUserId } from '../../../../lib/server/session';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const context = await getAuthenticatedPlannerContext(userId);
  if (!context) return NextResponse.json({ error: 'Onboarding incomplete' }, { status: 403 });

  const live = authorizeLiveIntervalsState(context, await getLiveIntervalsState());
  const entries = await getUserAdaptationEntries(userId);
  return NextResponse.json(buildAdaptationPayload(live, entries));
}
