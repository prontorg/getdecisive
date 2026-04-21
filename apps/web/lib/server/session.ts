import { cookies } from 'next/headers';

const SESSION_COOKIE = 'decisive_session_user';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type SessionCookieOverride = {
  value?: string;
  maxAge?: number;
  expires?: Date;
};

export async function getSessionUserId(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value || null;
}

function isSecureRequest(request: Request) {
  return new URL(request.url).protocol === 'https:';
}

export function buildSessionCookieOptions(request: Request, overrides: SessionCookieOverride = {}) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isSecureRequest(request),
    path: '/',
    maxAge: overrides.maxAge ?? SESSION_MAX_AGE_SECONDS,
    expires: overrides.expires,
    value: overrides.value ?? '',
  };
}

export function buildClearSessionCookieOptions(request: Request) {
  return buildSessionCookieOptions(request, {
    value: '',
    maxAge: 0,
    expires: new Date(0),
  });
}

export const sessionCookieName = SESSION_COOKIE;
