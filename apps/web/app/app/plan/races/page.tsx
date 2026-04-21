import Link from 'next/link';

import { AppCard, AppHero, AppPageShell } from '../../_components/material-shell';
import { appRoutes } from '../../../../lib/routes';

export default function PlanRacesPage() {
  return (
    <AppPageShell>
      <AppHero
        eyebrow="Plan"
        title="Race calendar"
        description="Manage the upcoming races and planning events that should shape the next monthly draft."
      />

      <section className="mt-18">
        <AppCard className="training-plan-step-card training-plan-step-card-goals">
          <div className="kicker">Goals and races</div>
          <h2>Race calendar</h2>
          <p>This page will hold planner-owned race and blackout events for the monthly workspace.</p>
          <div className="training-plan-top-strip__actions">
            <Link href={appRoutes.plan} className="button-secondary button-link">Back to plan</Link>
            <Link href={appRoutes.styleGuide} className="button-secondary button-link">Open style guide</Link>
          </div>
        </AppCard>
      </section>
    </AppPageShell>
  );
}
