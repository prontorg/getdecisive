import { redirect } from 'next/navigation';

import { PlannerTabs } from '../_components/planner-tabs';
import { appRoutes } from '../../../lib/routes';
import { loadPlatformState } from '../../../lib/server/dev-store';
import { deriveOnboardingStatus, getOnboardingRun, getUserById, isAdminUser } from '../../../lib/server/platform-state';
import { getSessionUserId } from '../../../lib/server/session';

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ error?: string; notice?: string }> }) {
  const params = (await searchParams) || {};
  const userId = await getSessionUserId();
  if (!userId) redirect(appRoutes.login);

  const state = await loadPlatformState();
  const onboarding = deriveOnboardingStatus(state, userId) || getOnboardingRun(state, userId);
  const user = getUserById(state, userId);

  if (!user || !onboarding) redirect(appRoutes.login);
  if (!isAdminUser(state, userId)) redirect(appRoutes.dashboard);

  return (
    <main className="page-shell">
      <section className="hero hero-pretty">
        <div className="hero-copy">
          <div className="kicker">Admin</div>
          <h1>Invite-only control room</h1>
          <p>Keep admin focused on access, account security, and platform visibility. This tab is only shown to you.</p>
          <div className="chip-row">
            <span className="chip">Admin: {user.displayName}</span>
            <span className="chip">Email: {user.email}</span>
            <span className="chip">Users: {state.users.length}</span>
          </div>
        </div>
      </section>

      <PlannerTabs active="admin" isAdmin />

      <section className="panel-grid">
        <section className="card">
          <div className="kicker">Password</div>
          <h2>Change password</h2>
          <p>Update the password used for the decisive planner login.</p>
          {params.error ? <p className="notice error">{params.error}</p> : null}
          {params.notice ? <p className="notice">{params.notice}</p> : null}
          <form className="form-grid" action="/planner/api/auth/change-password" method="post">
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
        </section>

        <section className="card">
          <div className="kicker">Access model</div>
          <h2>Invite-only signup</h2>
          <p>The public view now splits cleanly between signup and beta enrollment, and the invite code is no longer visible in the signup form.</p>
          <div className="status-list">
            <div className="status-item"><strong>Invites in store</strong><p>{state.invites.length}</p></div>
            <div className="status-item"><strong>Used invites</strong><p>{state.invites.reduce((sum, invite) => sum + invite.usedCount, 0)}</p></div>
            <div className="status-item"><strong>Registered users</strong><p>{state.users.length}</p></div>
          </div>
        </section>
      </section>
    </main>
  );
}
