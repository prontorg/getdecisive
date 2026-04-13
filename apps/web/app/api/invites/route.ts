import { NextResponse } from 'next/server';

import { listInviteRecords, getMembershipRolesRecord } from '../../../lib/server/auth-store';
import { getSessionUserId } from '../../../lib/server/session';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const roles = await getMembershipRolesRecord(userId);
  if (!roles.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json({ invites: await listInviteRecords() });
}
