import Link from 'next/link';

type RegisterPanelProps = {
  error?: string;
  email?: string;
  name?: string;
  inviteCode?: string;
};

export function RegisterPanel({ error, email, name, inviteCode }: RegisterPanelProps) {
  return (
    <section className="card signup-card">
      <div className="kicker">Invite-only signup</div>
      <h2>Create your account</h2>
      <p className="muted">Keep signup simple here. Intervals connection happens in the guided onboarding step right after account creation.</p>
      {error ? <p className="notice error">{error}</p> : null}
      <form className="form-grid" action="/api/auth/register" method="post">
        <input name="inviteCode" type="hidden" value={inviteCode || ''} />
        <label>
          <span>Email</span>
          <input name="email" type="email" placeholder="athlete@example.com" defaultValue={email || ''} required autoComplete="email" />
        </label>
        <label>
          <span>Password</span>
          <input name="password" type="password" placeholder="Choose password" required autoComplete="new-password" />
        </label>
        <label>
          <span>Display name</span>
          <input name="displayName" type="text" placeholder="Athlete name" defaultValue={name || ''} required autoComplete="name" />
        </label>
        <div className="button-row">
          <button type="submit">Create account</button>
          <Link href="/login" className="button-secondary button-link">Already have access</Link>
        </div>
      </form>
    </section>
  );
}
