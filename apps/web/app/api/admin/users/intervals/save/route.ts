import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../../../lib/routes';
import { getMembershipRolesRecord, upsertManagedUserIntervalsConnectionRecord } from '../../../../../../lib/server/auth-store';
import { getSessionUserId } from '../../../../../../lib/server/session';
import { triggerSyncWorker } from '../../../../../../lib/server/sync-worker';

export async function POST(request: Request) {
  const actorUserId = await getSessionUserId();
  if (!actorUserId) return NextResponse.redirect(new URL(appRoutes.login, request.url));
  const roles = await getMembershipRolesRecord(actorUserId);
  if (!roles.includes('admin')) return NextResponse.redirect(new URL(appRoutes.dashboard, request.url));

  const formData = await request.formData();
  const userId = String(formData.get('userId') || '').trim();
  const athleteId = String(formData.get('athleteId') || '');
  const credentialPayload = String(formData.get('credentialPayload') || '');
  const connectionLabel = String(formData.get('connectionLabel') || '');

  try {
    if (!userId) throw new Error('User id is required');
    await upsertManagedUserIntervalsConnectionRecord(userId, { athleteId, credentialPayload, connectionLabel });
    triggerSyncWorker(process.env.DECISIVE_PLATFORM_STORE_PATH);
    return NextResponse.redirect(new URL(`${appRoutes.admin}?notice=${encodeURIComponent('Intervals settings saved')}`, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save Intervals settings';
    return NextResponse.redirect(new URL(`${appRoutes.admin}?error=${encodeURIComponent(message)}`, request.url));
  }
}
