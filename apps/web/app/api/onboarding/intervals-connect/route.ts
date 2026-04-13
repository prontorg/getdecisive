import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../lib/routes';
import { loadPlatformState, savePlatformState } from '../../../../lib/server/dev-store';
import { applyIntervalsCredentials } from '../../../../lib/server/platform-state';
import { getSessionUserId } from '../../../../lib/server/session';

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.redirect(new URL(appRoutes.login, request.url));
  }

  const formData = await request.formData();
  const athleteId = String(formData.get('athleteId') || '');
  const credentialPayload = String(formData.get('credentialPayload') || '');
  const connectionLabel = String(formData.get('connectionLabel') || '');

  const state = await loadPlatformState();
  try {
    applyIntervalsCredentials(state, userId, { athleteId, credentialPayload, connectionLabel });
    await savePlatformState(state);
    return NextResponse.redirect(new URL(appRoutes.onboardingSync, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not connect Intervals';
    return NextResponse.redirect(new URL(`${appRoutes.onboardingIntervals}?error=${encodeURIComponent(message)}`, request.url));
  }
}
