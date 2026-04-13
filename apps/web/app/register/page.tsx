import { RegisterPanel } from '../../components/auth/RegisterPanel';

export default async function RegisterPage({ searchParams }: { searchParams?: Promise<{ error?: string; email?: string; name?: string; inviteCode?: string }> }) {
  const params = (await searchParams) || {};
  return (
    <main className="page-shell auth-shell">
      <section className="hero hero-pretty auth-hero">
        <div className="hero-copy auth-hero-copy">
          <div className="kicker">Selective access</div>
          <h1>Private signup</h1>
          <p>Use your private invite link to create a decisive planner account. Beta interest belongs on the separate request track.</p>
        </div>
      </section>
      <section className="auth-split">
        <RegisterPanel error={params.error} email={params.email} name={params.name} inviteCode={params.inviteCode} />
        <section className="card beta-card">
          <div className="kicker">Not invited yet?</div>
          <h2>Enroll for beta</h2>
          <p>Request V.I.P. beta consideration separately if you do not already have a private invite link.</p>
          <form method="post" action="mailto:tobias.wildi@gmail.com?subject=VIP%20Beta%20Program%20Access%20Request" encType="text/plain" className="form-grid">
            <label>
              <span>Email address</span>
              <input name="Email" type="email" placeholder="you@example.com" required />
            </label>
            <div className="button-row">
              <button type="submit">Enroll for beta</button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
