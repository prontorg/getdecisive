import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../lib/routes';
import { loadPlatformState, savePlatformState } from '../../../../lib/server/dev-store';
import { registerUserWithInvite } from '../../../../lib/server/platform-state';
import { buildSessionCookieOptions, sessionCookieName } from '../../../../lib/server/session';

export async function POST(request: Request) {
  const formData = await request.formData();
  const inviteCode = String(formData.get('inviteCode') || '');
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  const displayName = String(formData.get('displayName') || '');

  const state = await loadPlatformState();

  try {
    const registration = registerUserWithInvite(state, { inviteCode, email, password, displayName });
    await savePlatformState(state);
    const response = NextResponse.redirect(new URL(appRoutes.onboardingIntervals, request.url));
    const cookie = buildSessionCookieOptions(request, { value: registration.user.id });
    response.cookies.set(sessionCookieName, cookie.value, cookie);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.redirect(new URL(`${appRoutes.register}?error=${encodeURIComponent(message)}`, request.url));
  }
}
