import { redirect } from 'next/navigation';

import { getSessionUserId } from '../lib/server/session';

export default async function LandingPage() {
  const userId = await getSessionUserId();
  redirect(userId ? '/app/dashboard' : '/login');
}
