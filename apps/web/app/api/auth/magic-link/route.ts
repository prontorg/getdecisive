import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../lib/routes';

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get('email') || '').trim();
  const message = email
    ? `Magic link is not wired yet. Planned launch support for ${email}.`
    : 'Magic link needs an email address.';
  return NextResponse.redirect(new URL(`${appRoutes.login}?notice=${encodeURIComponent(message)}`, request.url));
}
