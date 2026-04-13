import { redirect } from 'next/navigation';

import { AppCard, AppHero, AppPageShell } from '../_components/material-shell';
import { appRoutes } from '../../../lib/routes';
import { getAuthenticatedAppContext } from '../../../lib/server/app-context';
import { getSessionUserId } from '../../../lib/server/session';

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ error?: string; notice?: string }> }) {
  const params = (await searchParams) || {};
  const userId = await getSessionUserId();
  if (!userId) redirect(appRoutes.login);

  const { user, onboarding, state } = await getAuthenticatedAppContext(userId, { requireAdmin: true });

  return (
    <AppPageShell tone="admin">
      <AppHero
        eyebrow="Admin"
        title="Invite-only control room"
        description="Keep admin focused on access, account security, and platform visibility. This tab is only shown to you."
        chips={(
          <>
            <span className="chip">Admin: {user.displayName}</span>
            <span className="chip">Email: {user.email}</span>
            <span className="chip">Users: {state.users.length}</span>
          </>
        )}
      />

      <section className="panel-grid">
        <AppCard>
          <div className="kicker">Password</div>
          <h2>Change password</h2>
          <p>Update the password used for the decisive planner login.</p>
          {params.error ? <p className="notice error">{params.error}</p> : null}
          {params.notice ? <p className="notice">{params.notice}</p> : null}
          <form className="form-grid" action="/api/auth/change-password" method="post">
            <label>
              <span>Current password</span>
              <input name="currentPassword" type="password" placeholder="Current password" required />
            </label>
            <label>
              <span>New password</span>
              <input name="nextPassword" type="password" placeholder="New password" required />
            </label>
            <label>
              <span>Confirm new password</span>
              <input name="confirmPassword" type="password" placeholder="Repeat new password" required />
            </label>
            <div className="button-row">
              <button type="submit">Update password</button>
            </div>
          </form>
        </AppCard>

        <AppCard>
          <div className="kicker">Access model</div>
          <h2>Invite-only signup</h2>
          <p>The public view now splits cleanly between signup and beta enrollment, and the invite code is no longer visible in the signup form.</p>
          <div className="status-list">
            <div className="status-item"><strong>Invites in store</strong><p>{state.invites.length}</p></div>
            <div className="status-item"><strong>Used invites</strong><p>{state.invites.reduce((sum, invite) => sum + invite.usedCount, 0)}</p></div>
            <div className="status-item"><strong>Registered users</strong><p>{state.users.length}</p></div>
          </div>
          <form className="form-grid" action="/api/invites/create" method="post" style={{ marginTop: 16 }}>
            <label>
              <span>Invite code</span>
              <input name="code" type="text" placeholder="DECISIVE-BETA" />
            </label>
            <label>
              <span>Max uses</span>
              <input name="maxUses" type="number" min="1" defaultValue="1" required />
            </label>
            <div className="button-row">
              <button type="submit">Create invite</button>
            </div>
          </form>
          <div className="status-list" style={{ marginTop: 16 }}>
            {state.invites.map((invite) => (
              <div className="status-item" key={invite.id}>
                <strong>{invite.code}</strong>
                <p>Status: {invite.status} • Used {invite.usedCount}/{invite.maxUses}</p>
                {invite.status === 'active' ? (
                  <form action="/api/invites/revoke" method="post">
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <button type="submit" className="button-secondary">Revoke</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </AppCard>
      </section>
    </AppPageShell>
  );
}
