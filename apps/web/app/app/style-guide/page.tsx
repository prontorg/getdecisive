import { AppCard, AppHero, AppPageShell } from '../_components/material-shell';

export default function StyleGuidePage() {
  return (
    <AppPageShell>
      <AppHero
        eyebrow="Style guide"
        title="Planner style guide"
        description="Reference page for planner step colors, race badges, and calmer monthly-planning surfaces."
      />

      <section className="training-plan-step-grid mt-18">
        <AppCard className="training-plan-step-card training-plan-step-card-status">
          <div className="kicker">Status quo</div>
          <h2>Step color</h2>
          <p>Use this surface for history-led assessment and trust-building facts.</p>
        </AppCard>
        <AppCard className="training-plan-step-card training-plan-step-card-goals">
          <div className="kicker">Goals and races</div>
          <h2>Step color</h2>
          <p>Use this surface for monthly focus, target event, and race anchors.</p>
        </AppCard>
        <AppCard className="training-plan-step-card training-plan-step-card-parameters">
          <div className="kicker">Parameters</div>
          <h2>Step color</h2>
          <p>Use this surface for small planning constraints like hours and rest density.</p>
        </AppCard>
        <AppCard className="training-plan-step-card training-plan-step-card-draft">
          <div className="kicker">Draft next month</div>
          <h2>Step color</h2>
          <p>Use this surface for the generated month and final planning review.</p>
        </AppCard>
      </section>

      <section className="training-plan-step-grid mt-18">
        <AppCard>
          <div className="kicker">Race badge</div>
          <div className="chip-row">
            <span className="chip planner-race-badge planner-race-badge-a">A race</span>
            <span className="chip planner-race-badge planner-race-badge-b">B race</span>
            <span className="chip planner-race-badge planner-race-badge-c">C race</span>
            <span className="chip planner-race-badge planner-race-badge-blackout">Blackout</span>
          </div>
        </AppCard>
      </section>
    </AppPageShell>
  );
}
