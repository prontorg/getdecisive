import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../../lib/routes';
import {
  createManagedUserRecord,
  updateManagedUserRecord,
} from '../../../../../lib/server/auth-store';
import { captureRouteError, redirectWithError, redirectWithNotice, requireAdminActor } from '../../../../../lib/server/route-observability';
import { getSessionUserId } from '../../../../../lib/server/session';

const ROUTE = '/api/admin/users/save';

function parseRoles(raw: FormDataEntryValue | null) {
  return String(raw || 'athlete')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean) as Array<'athlete' | 'coach' | 'admin'>;
}

export async function POST(request: Request) {
  const actorUserId = await getSessionUserId();
  const adminAccess = await requireAdminActor(actorUserId, ROUTE, request);
  if (!adminAccess.allowed) return adminAccess.response;

  const formData = await request.formData();
  const userId = String(formData.get('userId') || '').trim();
  const email = String(formData.get('email') || '');
  const displayName = String(formData.get('displayName') || '');
  const password = String(formData.get('password') || '');
  const managedRoles = parseRoles(formData.get('roles'));

  try {
    if (userId) {
      await updateManagedUserRecord(userId, { email, displayName, password, roles: managedRoles });
      return redirectWithNotice(ROUTE, request, `${appRoutes.admin}?notice=${encodeURIComponent('User updated')}`, { actorUserId, userId, roles: managedRoles.join(',') });
    }
    await createManagedUserRecord(actorUserId!, { email, displayName, password, roles: managedRoles });
    return redirectWithNotice(ROUTE, request, `${appRoutes.admin}?notice=${encodeURIComponent('User created')}`, { actorUserId, email, roles: managedRoles.join(',') });
  } catch (error) {
    const message = captureRouteError(ROUTE, error, { actorUserId, userId: userId || null, email, roles: managedRoles.join(',') });
    return redirectWithError(ROUTE, request, `${appRoutes.admin}?error=${encodeURIComponent(message)}`, message, { actorUserId, userId: userId || null, email });
  }
}
