import { redirect } from 'next/navigation';

import { AppCard, AppHero, AppPageShell } from '../_components/material-shell';
import { appRoutes } from '../../../lib/routes';
import { getAuthenticatedAppContext } from '../../../lib/server/app-context';
import { getSessionUserId } from '../../../lib/server/session';

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect(appRoutes.login);

  const appContext = await getAuthenticatedAppContext(userId, { requireReady: true });
  const { user, onboarding } = appContext;

  return (
    <AppPageShell>
      <AppHero
        eyebrow="Dashboard"
        title="Coach dashboard"
        description={(
          <>
            Welcome, {user.displayName}. This first tab now embeds the original decisive.coach dashboard so the
            stronger live coaching view stays front and center inside the shared platform shell.
          </>
        )}
        chips={(
          <>
            <span className="chip">User: {user.email}</span>
            <span className="chip">Onboarding: {onboarding.state}</span>
            <span className="chip">Source: decisive.coach</span>
          </>
        )}
      />

      <AppCard className="dashboard-embed-card">
        <div className="kicker">Embedded live view</div>
        <h2>Original dashboard</h2>
        <p className="muted">
          This keeps the better coaching dashboard in the first tab while preserving the shared Material header and
          navigation for the wider platform.
        </p>
        <div className="dashboard-embed-frame-shell">
          <iframe
            src="/"
            title="Decisive coach dashboard"
            className="dashboard-embed-frame"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </AppCard>
    </AppPageShell>
  );
}
