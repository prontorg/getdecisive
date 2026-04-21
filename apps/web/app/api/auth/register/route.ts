import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../lib/routes';
import { registerUserWithInviteRecord } from '../../../../lib/server/auth-store';
import { buildSessionCookieOptions, sessionCookieName } from '../../../../lib/server/session';

export async function POST(request: Request) {
  const formData = await request.formData();
  const inviteCode = String(formData.get('inviteCode') || '');
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  const displayName = String(formData.get('displayName') || '');

  try {
    const registration = await registerUserWithInviteRecord({ inviteCode, email, password, displayName });
    const response = NextResponse.redirect(new URL(appRoutes.onboardingIntervals, request.url));
    const cookie = buildSessionCookieOptions(request, { value: registration.user.id });
    response.cookies.set(sessionCookieName, cookie.value, cookie);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    const query = new URLSearchParams({ error: message });
    if (inviteCode) query.set('inviteCode', inviteCode);
    if (email) query.set('email', email);
    if (displayName) query.set('name', displayName);
    return NextResponse.redirect(new URL(`${appRoutes.register}?${query.toString()}`, request.url));
  }
}
