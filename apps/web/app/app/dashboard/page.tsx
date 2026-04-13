import { redirect } from 'next/navigation';

import { appRoutes } from '../../../lib/routes';
import { fetchCoachDashboardEmbed } from '../../../lib/server/coach-dashboard';
import { getAuthenticatedAppContext } from '../../../lib/server/app-context';
import { getAuthorizedPlannerLiveContext } from '../../../lib/server/planner-data';
import { getSessionUserId } from '../../../lib/server/session';

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect(appRoutes.login);

  await getAuthenticatedAppContext(userId, { requireReady: true });
  const planner = await getAuthorizedPlannerLiveContext(userId);
  if (!planner) redirect(appRoutes.onboardingSync);

  const embed = await fetchCoachDashboardEmbed();

  if (!embed) {
    return (
      <main className="page-shell">
        <section className="card md-surface md-surface-card">
          <div className="kicker">Dashboard unavailable</div>
          <h1>Coach dashboard could not be loaded</h1>
          <p className="muted">The live dashboard fragment did not load from the local coach service.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell dashboard-fragment-shell">
      <style dangerouslySetInnerHTML={{ __html: embed.styleTag }} />
      <div
        className="dashboard-fragment-host"
        dangerouslySetInnerHTML={{ __html: embed.bodyInnerHtml }}
      />
    </main>
  );
}
