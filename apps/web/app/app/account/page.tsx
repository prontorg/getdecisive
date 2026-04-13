import { redirect } from 'next/navigation';

import { appRoutes } from '../../../lib/routes';
import { getAuthenticatedAppContext } from '../../../lib/server/app-context';
import { getSessionUserId } from '../../../lib/server/session';

export default async function AccountPage({ searchParams }: { searchParams?: Promise<{ error?: string; notice?: string }> }) {
  const params = (await searchParams) || {};
  const userId = await getSessionUserId();
  if (!userId) redirect(appRoutes.login);

  const { user, onboarding } = await getAuthenticatedAppContext(userId);

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <div className="kicker">Account</div>
          <h1>Your decisive account</h1>
          <p>Keep account access private. Analysis and planner views stay behind this login.</p>
          <div className="chip-row">
            <span className="chip">Email: {user.email}</span>
            <span className="chip">Onboarding: {onboarding.state}</span>
          </div>
        </div>
      </section>

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
          <div className="kicker">Access</div>
          <h2>Current account</h2>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Display name:</strong> {user.displayName}</p>
          <p><strong>Status:</strong> {onboarding.state}</p>
        </section>
      </section>
    </main>
  );
}
