import { redirect } from 'next/navigation';

import { appRoutes } from '../../../lib/routes';
import { getAuthenticatedAppContext } from '../../../lib/server/app-context';
import { getSessionUserId } from '../../../lib/server/session';

export default async function AdminPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect(appRoutes.login);

  await getAuthenticatedAppContext(userId, { requireAdmin: true });
  redirect(`${appRoutes.account}?tab=user-management`);
}
