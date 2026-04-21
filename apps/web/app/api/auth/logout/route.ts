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

function buildCrossSiteBlockedResponse(request: Request) {
  const loginUrl = new URL(appRoutes.login, request.url);
  loginUrl.searchParams.set('notice', 'Use the in-app logout button');
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: Request) {
  return buildCrossSiteBlockedResponse(request);
}

export async function POST(request: Request) {
  return buildLogoutResponse(request);
}
