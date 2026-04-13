import { NextResponse } from 'next/server';

import { buildPowerProfilePayload, getAuthorizedPlannerLiveContext } from '../../../../lib/server/planner-data';
import { getSessionUserId } from '../../../../lib/server/session';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const planner = await getAuthorizedPlannerLiveContext(userId);
  if (!planner) return NextResponse.json({ error: 'Onboarding incomplete' }, { status: 403 });

  return NextResponse.json(buildPowerProfilePayload(planner.live));
}
