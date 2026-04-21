import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../lib/routes';
import { getMembershipRolesRecord, revokeInviteRecord } from '../../../../lib/server/auth-store';
import { getSessionUserId } from '../../../../lib/server/session';

function accountInvitesUrl(messageKey: 'notice' | 'error', message: string, request: Request) {
  return new URL(`${appRoutes.account}?tab=invites&${messageKey}=${encodeURIComponent(message)}`, request.url);
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.redirect(new URL(appRoutes.login, request.url));

  const roles = await getMembershipRolesRecord(userId);
  if (!roles.includes('admin')) return NextResponse.redirect(new URL(appRoutes.dashboard, request.url));

  const formData = await request.formData();
  const inviteId = String(formData.get('inviteId') || '');

  try {
    const invite = await revokeInviteRecord(userId, inviteId);
    return NextResponse.redirect(accountInvitesUrl('notice', `Invite ${invite.code} revoked`, request));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not revoke invite';
    return NextResponse.redirect(accountInvitesUrl('error', message, request));
  }
}
