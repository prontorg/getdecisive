import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppCard, AppHero, AppPageShell } from '../../_components/material-shell';
import { appRoutes } from '../../../../lib/routes';
import { listPlanningEvents } from '../../../../lib/server/planner-customization';
import { getSessionUserId } from '../../../../lib/server/session';

export default async function PlanRacesPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect(appRoutes.login);
  const events = await listPlanningEvents(userId);
  const params = (await searchParams) || {};

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
          <p>This page holds planner-owned race and blackout events for the monthly workspace.</p>
          {params.notice ? <p>{params.notice}</p> : null}
          <form action="/api/planner/month/events" method="post" className="training-plan-direction-grid mt-18">
            <label>
              <span>Race title</span>
              <input name="title" type="text" placeholder="Race title" />
            </label>
            <label>
              <span>Date</span>
              <input name="date" type="date" />
            </label>
            <label>
              <span>Hours</span>
              <input name="durationHours" type="number" min="0" step="0.5" placeholder="3.5" />
            </label>
            <label>
              <span>Type</span>
              <select name="type">
                <option value="A_race">A race</option>
                <option value="B_race">B race</option>
                <option value="C_race">C race</option>
                <option value="training_camp">Training camp</option>
                <option value="travel">Travel</option>
                <option value="blackout">Blackout</option>
              </select>
            </label>
            <label>
              <span>Priority</span>
              <select name="priority">
                <option value="primary">Primary</option>
                <option value="support">Support</option>
                <option value="optional">Optional</option>
              </select>
            </label>
            <label>
              <span>Notes</span>
              <input name="notes" type="text" placeholder="Optional notes" />
            </label>
            <button type="submit">Save event</button>
          </form>
          <div className="training-plan-review-guide-grid training-plan-review-guide-grid-compact mt-18">
            {events.length ? events.map((event) => (
              <div key={event.id} className="training-plan-guide-card">
                <strong>{event.title}</strong>
                <p>{event.date} • {event.type} • {event.priority}{event.durationHours ? ` • ${event.durationHours} h` : ''}</p>
              </div>
            )) : <div className="training-plan-guide-card"><strong>No events yet</strong><p>Add the races that should shape the month.</p></div>}
          </div>
          <div className="training-plan-top-strip__actions mt-18">
            <Link href={appRoutes.plan} className="button-secondary button-link">Back to plan</Link>
            <Link href={appRoutes.styleGuide} className="button-secondary button-link">Open style guide</Link>
          </div>
        </AppCard>
      </section>
    </AppPageShell>
  );
}
