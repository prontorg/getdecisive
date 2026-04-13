import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../lib/routes';
import { loadPlatformState } from '../../../../lib/server/dev-store';
import { deriveOnboardingStatus, loginWithPassword } from '../../../../lib/server/platform-state';
import { buildSessionCookieOptions, sessionCookieName } from '../../../../lib/server/session';

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  const state = await loadPlatformState();
  const user = loginWithPassword(state, email, password);

  if (!user) {
    return NextResponse.redirect(new URL(`${appRoutes.login}?error=${encodeURIComponent('Invalid email or password')}`, request.url));
  }

  const onboarding = deriveOnboardingStatus(state, user.id);
  const nextUrl = onboarding?.state === 'ready' ? appRoutes.dashboard : appRoutes.onboardingSync;
  const response = NextResponse.redirect(new URL(nextUrl, request.url));
  const cookie = buildSessionCookieOptions(request, { value: user.id });
  response.cookies.set(sessionCookieName, cookie.value, cookie);
  return response;
}
