import { redirect } from 'next/navigation';

import { getPlatformState, getUserByIdRecord, getOnboardingRunRecord, getMembershipRolesRecord } from './auth-store';

export type AuthenticatedAppContext = {
  userId: string;
  user: Awaited<ReturnType<typeof getUserByIdRecord>> extends infer T ? NonNullable<T> : never;
  state: Awaited<ReturnType<typeof getPlatformState>>;
  onboarding: Awaited<ReturnType<typeof getOnboardingRunRecord>> extends infer T ? NonNullable<T> : never;
  isAdmin: boolean;
};

export async function getAuthenticatedAppContext(
  userId: string,
  options: { requireReady?: boolean; requireAdmin?: boolean } = {},
): Promise<AuthenticatedAppContext> {
  const state = await getPlatformState();
  const onboarding = await getOnboardingRunRecord(userId);
  const user = await getUserByIdRecord(userId);

  if (!user || !onboarding) redirect('/login');

  const roles = await getMembershipRolesRecord(userId);
  const admin = roles.includes('admin');
  if (options.requireReady && onboarding.state !== 'ready') redirect('/onboarding/sync-status');
  if (options.requireAdmin && !admin) redirect('/app/dashboard');

  return {
    userId,
    user,
    state,
    onboarding,
    isAdmin: admin,
  };
}
