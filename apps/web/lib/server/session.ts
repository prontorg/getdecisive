import { cookies } from 'next/headers';

const SESSION_COOKIE = 'decisive_session_user';

export async function getSessionUserId(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value || null;
}

export const sessionCookieName = SESSION_COOKIE;
