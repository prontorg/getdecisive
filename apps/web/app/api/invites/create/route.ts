import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../lib/routes';
import { createInviteRecord, getMembershipRolesRecord } from '../../../../lib/server/auth-store';
import { getSessionUserId } from '../../../../lib/server/session';

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.redirect(new URL(appRoutes.login, request.url));

  const roles = await getMembershipRolesRecord(userId);
  if (!roles.includes('admin')) return NextResponse.redirect(new URL(appRoutes.dashboard, request.url));

  const formData = await request.formData();
  const code = String(formData.get('code') || '');
  const maxUses = Number(formData.get('maxUses') || '1');

  try {
    const invite = await createInviteRecord(userId, { code, maxUses });
    return NextResponse.redirect(new URL(`${appRoutes.admin}?notice=${encodeURIComponent(`Invite ${invite.code} created`)}`, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create invite';
    return NextResponse.redirect(new URL(`${appRoutes.admin}?error=${encodeURIComponent(message)}`, request.url));
  }
}
