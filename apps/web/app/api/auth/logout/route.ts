import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../lib/routes';
import { buildSessionCookieOptions, sessionCookieName } from '../../../../lib/server/session';

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL(appRoutes.login, request.url));
  const cookie = buildSessionCookieOptions(request, { value: '', maxAge: 0 });
  response.cookies.set(sessionCookieName, cookie.value, cookie);
  return response;
}
