import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../lib/routes';
import { loadPlatformState, savePlatformState } from '../../../../lib/server/dev-store';
import { applyIntervalsCredentials, registerUserWithInvite } from '../../../../lib/server/platform-state';
import { sessionCookieName } from '../../../../lib/server/session';

export async function POST(request: Request) {
  const formData = await request.formData();
  const inviteCode = String(formData.get('inviteCode') || '');
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  const displayName = String(formData.get('displayName') || '');
  const athleteId = String(formData.get('athleteId') || '');
  const credentialPayload = String(formData.get('credentialPayload') || '');
  const connectionLabel = String(formData.get('connectionLabel') || '');

  const state = await loadPlatformState();

  try {
    const registration = registerUserWithInvite(state, { inviteCode, email, password, displayName });
    const wantsIntervalsLink = athleteId.trim() && credentialPayload.trim();
    if (wantsIntervalsLink) {
      applyIntervalsCredentials(state, registration.user.id, { athleteId, credentialPayload, connectionLabel });
    }
    await savePlatformState(state);
    const response = NextResponse.redirect(new URL(wantsIntervalsLink ? appRoutes.onboardingSync : appRoutes.onboardingIntervals, request.url));
    response.cookies.set(sessionCookieName, registration.user.id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.redirect(new URL(`${appRoutes.register}?error=${encodeURIComponent(message)}`, request.url));
  }
}
