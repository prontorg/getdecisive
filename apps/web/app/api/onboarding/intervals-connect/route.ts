import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../lib/routes';
import { applyIntervalsCredentialsRecord, getDerivedOnboardingStatusRecord } from '../../../../lib/server/auth-store';
import { getSessionUserId } from '../../../../lib/server/session';
import { triggerSyncWorker } from '../../../../lib/server/sync-worker';

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.redirect(new URL(appRoutes.login, request.url));
  }

  const formData = await request.formData();
  const athleteId = String(formData.get('athleteId') || '');
  const credentialPayload = String(formData.get('credentialPayload') || '');
  const connectionLabel = String(formData.get('connectionLabel') || '');

  try {
    await applyIntervalsCredentialsRecord(userId, { athleteId, credentialPayload, connectionLabel });
    try {
      triggerSyncWorker(process.env.DECISIVE_PLATFORM_STORE_PATH);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not launch sync worker';
      return NextResponse.redirect(new URL(`${appRoutes.onboardingIntervals}?error=${encodeURIComponent(message)}`, request.url));
    }
    const onboarding = await getDerivedOnboardingStatusRecord(userId);
    const destination = onboarding?.state === 'ready'
      ? appRoutes.dashboard
      : appRoutes.onboardingSync;
    return NextResponse.redirect(new URL(destination, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not connect Intervals';
    return NextResponse.redirect(new URL(`${appRoutes.onboardingIntervals}?error=${encodeURIComponent(message)}`, request.url));
  }
}
