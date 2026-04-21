import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../../lib/routes';
import { deleteManagedUserRecord, getMembershipRolesRecord } from '../../../../../lib/server/auth-store';
import { getSessionUserId } from '../../../../../lib/server/session';

export async function POST(request: Request) {
  const actorUserId = await getSessionUserId();
  if (!actorUserId) return NextResponse.redirect(new URL(appRoutes.login, request.url));
  const roles = await getMembershipRolesRecord(actorUserId);
  if (!roles.includes('admin')) return NextResponse.redirect(new URL(appRoutes.dashboard, request.url));

  const formData = await request.formData();
  const userId = String(formData.get('userId') || '').trim();

  try {
    if (!userId) throw new Error('User id is required');
    await deleteManagedUserRecord(userId);
    return NextResponse.redirect(new URL(`${appRoutes.admin}?notice=${encodeURIComponent('User deleted')}`, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not delete user';
    return NextResponse.redirect(new URL(`${appRoutes.admin}?error=${encodeURIComponent(message)}`, request.url));
  }
}
