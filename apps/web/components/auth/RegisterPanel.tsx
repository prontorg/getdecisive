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
      <p className="muted">This form only works from a private invite link. The invite code stays hidden.</p>
      {error ? <p className="notice error">{error}</p> : null}
      <form className="form-grid" action="/planner/api/auth/register" method="post">
        <input name="inviteCode" type="hidden" value={inviteCode || ''} />
        <label>
          <span>Email</span>
          <input name="email" type="email" placeholder="athlete@example.com" defaultValue={email || ''} required />
        </label>
        <label>
          <span>Password</span>
          <input name="password" type="password" placeholder="Choose password" required />
        </label>
        <label>
          <span>Display name</span>
          <input name="displayName" type="text" placeholder="Athlete name" defaultValue={name || ''} required />
        </label>

        <div className="card signup-inner-card">
          <div className="kicker">Optional during signup</div>
          <h3>Link Intervals now</h3>
          <p className="muted">Add it now if you want to land straight in sync after signup.</p>
          <div className="form-grid">
            <label>
              <span>Intervals athlete ID</span>
              <input name="athleteId" type="text" placeholder="17634020" />
            </label>
            <label>
              <span>Intervals credential / API key</span>
              <textarea name="credentialPayload" placeholder="Paste guided credential info here" rows={5} />
            </label>
            <label>
              <span>Connection label</span>
              <input name="connectionLabel" type="text" placeholder="Primary Intervals account" defaultValue="Primary account" />
            </label>
          </div>
        </div>

        <div className="button-row">
          <button type="submit">Create account</button>
          <Link href="/login" className="button-secondary button-link">Already have access</Link>
        </div>
      </form>
    </section>
  );
}
