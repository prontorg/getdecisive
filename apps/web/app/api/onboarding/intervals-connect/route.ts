import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../lib/routes';
import { applyIntervalsCredentialsRecord, getDerivedOnboardingStatusRecord } from '../../../../lib/server/auth-store';
import { captureRouteError, logRouteEvent, redirectWithError, redirectWithNotice } from '../../../../lib/server/route-observability';
import { getSessionUserId } from '../../../../lib/server/session';
import { triggerSyncWorker } from '../../../../lib/server/sync-worker';

const ROUTE = '/api/onboarding/intervals-connect';

function resolveRedirectPath(raw: string | null | undefined, fallback: string) {
  const value = (raw || '').trim();
  if (!value.startsWith('/')) return fallback;
  return value;
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return redirectWithError(ROUTE, request, appRoutes.login, 'Intervals connect blocked because no active session exists');
  }

  const formData = await request.formData();
  const athleteId = String(formData.get('athleteId') || '');
  const credentialPayload = String(formData.get('credentialPayload') || '');
  const connectionLabel = String(formData.get('connectionLabel') || '');
  const redirectTo = resolveRedirectPath(String(formData.get('redirectTo') || ''), appRoutes.onboardingIntervals);

  try {
    await applyIntervalsCredentialsRecord(userId, { athleteId, credentialPayload, connectionLabel });
    logRouteEvent(ROUTE, 'info', 'Intervals credentials saved', { userId, athleteId, redirectTo });
    try {
      triggerSyncWorker(process.env.DECISIVE_PLATFORM_STORE_PATH);
    } catch (error) {
      const message = captureRouteError(ROUTE, error, { userId, athleteId, phase: 'triggerSyncWorker' });
      return redirectWithError(ROUTE, request, `${redirectTo}?error=${encodeURIComponent(message)}`, message, { userId, athleteId });
    }
    const onboarding = await getDerivedOnboardingStatusRecord(userId);
    const destination = onboarding?.state === 'ready'
      ? appRoutes.dashboard
      : redirectTo === appRoutes.onboardingIntervals ? appRoutes.onboardingSync : `${redirectTo}?notice=${encodeURIComponent('Intervals sync started')}`;
    return redirectWithNotice(ROUTE, request, destination, { userId, athleteId, onboardingState: onboarding?.state || null });
  } catch (error) {
    const message = captureRouteError(ROUTE, error, { userId, athleteId, redirectTo });
    return redirectWithError(ROUTE, request, `${redirectTo}?error=${encodeURIComponent(message)}`, message, { userId, athleteId, redirectTo });
  }
}
