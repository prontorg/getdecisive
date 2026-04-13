const tabs = [
  'Dashboard',
  'Plan',
  'Calendar',
  'Workouts',
  'Account',
  'Admin',
];

export default function LandingPage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <div className="kicker">Invite-only training planner</div>
          <h1>Get decisive</h1>
          <p>
            Decisive is evolving from a dashboard into a full training planner platform for athletes,
            coaches, and admin-led performance workflows.
          </p>
          <div className="chip-row">
            <span className="chip">Invite only</span>
            <span className="chip">Intervals required in v1</span>
            <span className="chip">Coach + athlete workflows</span>
          </div>
        </div>
      </section>

      <section className="nav-grid">
        {tabs.map((tab) => (
          <div key={tab} className="card">
            <div className="kicker">Platform tab</div>
            <h3>{tab}</h3>
            <p className="muted">Shell route planned for Milestone A/B.</p>
          </div>
        ))}
      </section>

      <section className="panel-grid">
        <div className="card">
          <div className="kicker">Onboarding spine</div>
          <h2>Milestone A</h2>
          <div className="status-list">
            <div className="status-item"><strong>1. Register</strong><div className="muted">Single-use invite code + launch auth</div></div>
            <div className="status-item"><strong>2. Connect Intervals</strong><div className="muted">Guided credential entry and validation</div></div>
            <div className="status-item"><strong>3. Sync status</strong><div className="muted">Transparent progress before app access</div></div>
            <div className="status-item"><strong>4. Dashboard shell</strong><div className="muted">Land in the product with clear next actions</div></div>
          </div>
        </div>

        <div className="card">
          <div className="kicker">Product decisions</div>
          <ul className="list">
            <li>Month-first calendar</li>
            <li>Form-first planning flow</li>
            <li>Daily readiness in v1</li>
            <li>Workout export for all sessions</li>
            <li>Coach, athlete, and admin capabilities</li>
          </ul>
        </div>

        <div className="card">
          <div className="kicker">Next build steps</div>
          <ul className="list">
            <li>Create auth + invite flow</li>
            <li>Implement onboarding state machine</li>
            <li>Add guided Intervals connection</li>
            <li>Wire worker sync job</li>
            <li>Add dashboard shell routes</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
