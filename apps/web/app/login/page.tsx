import React from 'react';

import { appRoutes } from '../../lib/routes';
import { LoginPanel } from '../../components/auth/LoginPanel';

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; notice?: string; inviteCode?: string }> }) {
  const params = (await searchParams) || {};
  const inviteHref = params.inviteCode ? `${appRoutes.register}?inviteCode=${encodeURIComponent(params.inviteCode)}` : null;

  return (
    <main className="page-shell auth-screen-shell auth-screen-shell-simple">
      <section className="auth-screen-panel auth-screen-panel-simple md-surface md-surface-raised">
        <LoginPanel error={params.error} />
        {inviteHref ? (
          <div className="button-row auth-invite-row">
            <a href={inviteHref} className="button-secondary button-link">Create account</a>
          </div>
        ) : null}
      </section>
    </main>
  );
}
