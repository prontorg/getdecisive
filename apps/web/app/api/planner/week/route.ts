import { NextResponse } from 'next/server';

import { getAuthenticatedPlannerContext } from '../../../../lib/server/planner-data';
import { getSessionUserId } from '../../../../lib/server/session';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const context = await getAuthenticatedPlannerContext(userId);
  if (!context) return NextResponse.json({ error: 'Onboarding incomplete' }, { status: 403 });

  return NextResponse.json({
    weekIntent: 'Keep the daily workflow integrated while the analysis layer remains separate and read-only.',
    keySessionsPlanned: ['Support day guidance in Dashboard/Plan', 'Separate analysis review in /app/analysis'],
    keySessionsCompleted: [],
    missingSystems: ['Real Intervals-backed reconciliation', 'Live goal engine'],
    fatigueTrend: 'Not yet connected to live wellness inside the separate platform scaffold.',
    riskFlags: ['No remote Intervals write-back allowed', 'Planner remains read-only toward external calendar'],
  });
}
