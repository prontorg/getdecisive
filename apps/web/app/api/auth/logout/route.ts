import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../lib/routes';
import { buildClearSessionCookieOptions, sessionCookieName } from '../../../../lib/server/session';

function buildLogoutResponse(request: Request) {
  const signedOutUrl = new URL(appRoutes.login, request.url);
  signedOutUrl.searchParams.set('notice', 'Signed out');

  const response = NextResponse.redirect(signedOutUrl);
  const cookie = buildClearSessionCookieOptions(request);
  response.cookies.set(sessionCookieName, cookie.value, cookie);
  response.cookies.delete({ name: sessionCookieName, path: '/', secure: cookie.secure, sameSite: cookie.sameSite });
  return response;
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST(request: Request) {
  return buildLogoutResponse(request);
}
