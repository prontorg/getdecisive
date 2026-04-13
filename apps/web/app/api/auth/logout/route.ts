import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../lib/routes';
import { sessionCookieName } from '../../../../lib/server/session';

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL(appRoutes.login, request.url));
  response.cookies.set(sessionCookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
