import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { appRoutes } from './lib/routes';
import { sessionCookieName } from './lib/server/session';

const AUTH_PAGES = new Set([appRoutes.landing, appRoutes.login, appRoutes.register]);

function redirectTo(path: string, request: NextRequest) {
  return NextResponse.redirect(new URL(path, request.url));
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const session = request.cookies.get(sessionCookieName)?.value;

  if (!session) {
    if (pathname === appRoutes.landing) {
      return redirectTo(appRoutes.login, request);
    }

    if (pathname.startsWith('/app') || pathname.startsWith('/onboarding')) {
      return redirectTo(appRoutes.login, request);
    }
  }

  if (session && AUTH_PAGES.has(pathname)) {
    return redirectTo(appRoutes.dashboard, request);
  }

  const response = NextResponse.next();
  response.headers.set('x-decisive-app-scope', 'decisive-platform');
  response.headers.set('x-decisive-current-path', pathname);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
