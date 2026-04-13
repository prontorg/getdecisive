import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'decisive_session_user';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('x-decisive-app-scope', 'planner-separate-site');
  response.headers.set('x-decisive-current-path', request.nextUrl.pathname);

  if (request.nextUrl.pathname.startsWith('/app')) {
    const session = request.cookies.get(SESSION_COOKIE)?.value;
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
