import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../lib/routes';
import { loadPlatformState, savePlatformState } from '../../../../lib/server/dev-store';
import { changeUserPassword } from '../../../../lib/server/platform-state';
import { getSessionUserId } from '../../../../lib/server/session';

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.redirect(new URL(appRoutes.login, request.url));

  const formData = await request.formData();
  const currentPassword = String(formData.get('currentPassword') || '');
  const nextPassword = String(formData.get('nextPassword') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  if (nextPassword !== confirmPassword) {
    return NextResponse.redirect(new URL(`${appRoutes.account}?error=${encodeURIComponent('New passwords do not match')}`, request.url));
  }

  const state = await loadPlatformState();
  try {
    changeUserPassword(state, userId, currentPassword, nextPassword);
    await savePlatformState(state);
    return NextResponse.redirect(new URL(`${appRoutes.account}?notice=${encodeURIComponent('Password updated')}`, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update password';
    return NextResponse.redirect(new URL(`${appRoutes.account}?error=${encodeURIComponent(message)}`, request.url));
  }
}
