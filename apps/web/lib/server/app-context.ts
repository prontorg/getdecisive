import { redirect } from 'next/navigation';

import { loadPlatformState } from './dev-store';
import { deriveOnboardingStatus, getOnboardingRun, getUserById, isAdminUser } from './platform-state';

export type AuthenticatedAppContext = {
  userId: string;
  user: NonNullable<ReturnType<typeof getUserById>>;
  state: Awaited<ReturnType<typeof loadPlatformState>>;
  onboarding: NonNullable<ReturnType<typeof getOnboardingRun>>;
  isAdmin: boolean;
};

export async function getAuthenticatedAppContext(
  userId: string,
  options: { requireReady?: boolean; requireAdmin?: boolean } = {},
): Promise<AuthenticatedAppContext> {
  const state = await loadPlatformState();
  const onboarding = deriveOnboardingStatus(state, userId) || getOnboardingRun(state, userId);
  const user = getUserById(state, userId);

  if (!user || !onboarding) redirect('/login');

  const admin = isAdminUser(state, userId);
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
