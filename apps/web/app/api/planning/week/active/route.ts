import { NextResponse } from 'next/server';

import { getSessionUserId } from '../../../../../lib/server/session';
import { ensureCurrentPlanningContext } from '../../../../../lib/server/planning/planning-store';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cycle, decision } = await ensureCurrentPlanningContext(userId);

  return NextResponse.json({
    cycle,
    todayDecision: decision,
  });
}
