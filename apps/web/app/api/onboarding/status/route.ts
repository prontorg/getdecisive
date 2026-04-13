import { NextResponse } from 'next/server';

import { loadPlatformState, savePlatformState } from '../../../../lib/server/dev-store';
import { deriveOnboardingStatus } from '../../../../lib/server/platform-state';
import { getSessionUserId } from '../../../../lib/server/session';
import { hydrateUserSnapshotFromSharedLive } from '../../../../lib/server/planner-data';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ state: 'invite_pending', progressPct: 0, statusMessage: 'No session' }, { status: 401 });
  }

  const state = await loadPlatformState();
  await hydrateUserSnapshotFromSharedLive(state, userId);
  const onboarding = deriveOnboardingStatus(state, userId);
  await savePlatformState(state);
  if (!onboarding) {
    return NextResponse.json({ state: 'invite_pending', progressPct: 0, statusMessage: 'No onboarding found' }, { status: 404 });
  }

  return NextResponse.json(onboarding);
}
