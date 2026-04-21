import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../../lib/routes';
import {
  createManagedUserRecord,
  getMembershipRolesRecord,
  updateManagedUserRecord,
} from '../../../../../lib/server/auth-store';
import { getSessionUserId } from '../../../../../lib/server/session';

function parseRoles(raw: FormDataEntryValue | null) {
  return String(raw || 'athlete')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean) as Array<'athlete' | 'coach' | 'admin'>;
}

export async function POST(request: Request) {
  const actorUserId = await getSessionUserId();
  if (!actorUserId) return NextResponse.redirect(new URL(appRoutes.login, request.url));
  const roles = await getMembershipRolesRecord(actorUserId);
  if (!roles.includes('admin')) return NextResponse.redirect(new URL(appRoutes.dashboard, request.url));

  const formData = await request.formData();
  const userId = String(formData.get('userId') || '').trim();
  const email = String(formData.get('email') || '');
  const displayName = String(formData.get('displayName') || '');
  const password = String(formData.get('password') || '');
  const managedRoles = parseRoles(formData.get('roles'));

  try {
    if (userId) {
      await updateManagedUserRecord(userId, { email, displayName, password, roles: managedRoles });
      return NextResponse.redirect(new URL(`${appRoutes.admin}?notice=${encodeURIComponent('User updated')}`, request.url));
    }
    await createManagedUserRecord(actorUserId, { email, displayName, password, roles: managedRoles });
    return NextResponse.redirect(new URL(`${appRoutes.admin}?notice=${encodeURIComponent('User created')}`, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save user';
    return NextResponse.redirect(new URL(`${appRoutes.admin}?error=${encodeURIComponent(message)}`, request.url));
  }
}
