import { NextResponse } from 'next/server';

import { getDerivedOnboardingStatusRecord } from '../../../../lib/server/auth-store';
import { getSessionUserId } from '../../../../lib/server/session';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ state: 'invite_pending', progressPct: 0, statusMessage: 'No session' }, { status: 401 });
  }

  const onboarding = await getDerivedOnboardingStatusRecord(userId);
  if (!onboarding) {
    return NextResponse.json({ state: 'invite_pending', progressPct: 0, statusMessage: 'No onboarding found' }, { status: 404 });
  }

  return NextResponse.json(onboarding);
}
