import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../lib/routes';
import { enqueueIntervalsRefreshOnLogin, getLatestIntervalsConnectionRecord, getOnboardingRunRecord, loginWithPasswordRecord } from '../../../../lib/server/auth-store';
import { buildSessionCookieOptions, sessionCookieName } from '../../../../lib/server/session';
import { triggerSyncWorker } from '../../../../lib/server/sync-worker';

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  const user = await loginWithPasswordRecord(email, password);

  if (!user) {
    return NextResponse.redirect(new URL(`${appRoutes.login}?error=${encodeURIComponent('Invalid email or password')}`, request.url));
  }

  const onboarding = await getOnboardingRunRecord(user.id);
  const nextUrl = onboarding?.state === 'ready' ? appRoutes.dashboard : appRoutes.onboardingSync;
  const response = NextResponse.redirect(new URL(nextUrl, request.url));
  const cookie = buildSessionCookieOptions(request, { value: user.id });
  response.cookies.set(sessionCookieName, cookie.value, cookie);

  const hasIntervalsConnection = Boolean(await getLatestIntervalsConnectionRecord(user.id));
  if (hasIntervalsConnection) {
    try {
      const queued = await enqueueIntervalsRefreshOnLogin(user.id);
      if (queued) triggerSyncWorker(process.env.DECISIVE_PLATFORM_STORE_PATH);
    } catch {
      // Login should still succeed even if the background refresh queue is unavailable.
    }
  }

  return response;
}
