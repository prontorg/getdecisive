import { NextResponse } from 'next/server';

import { getAuthenticatedPlannerContext } from '../../../../lib/server/planner-data';
import { getSessionUserId } from '../../../../lib/server/session';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const context = await getAuthenticatedPlannerContext(userId);
  if (!context) return NextResponse.json({ error: 'Onboarding incomplete' }, { status: 403 });

  return NextResponse.json({
    activeBlock: 'Read-only planner build',
    currentWeekWithinBlock: 1,
    mainEmphasis: 'Integrate daily view while isolating deep analysis in a separate tab',
    sessionsCompletedAgainstIntendedPattern: 'Scaffold mode',
    blockState: 'on_track_for_read_only_analysis',
    intervalsPlanWriteState: 'disabled_read_only',
  });
}
