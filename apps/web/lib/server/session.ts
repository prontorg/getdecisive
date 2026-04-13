import { cookies } from 'next/headers';

const SESSION_COOKIE = 'decisive_session_user';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type SessionCookieOverride = {
  value?: string;
  maxAge?: number;
};

export async function getSessionUserId(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value || null;
}

export function buildSessionCookieOptions(request: Request, overrides: SessionCookieOverride = {}) {
  const isHttps = new URL(request.url).protocol === 'https:';
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isHttps,
    path: '/',
    maxAge: overrides.maxAge ?? SESSION_MAX_AGE_SECONDS,
    value: overrides.value ?? '',
  };
}

export const sessionCookieName = SESSION_COOKIE;
