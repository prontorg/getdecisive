type RegisterPanelProps = {
  error?: string;
  email?: string;
  name?: string;
  inviteCode?: string;
};

export function RegisterPanel({ error, email, name, inviteCode }: RegisterPanelProps) {
  const hasInviteCode = Boolean(inviteCode);
  const inviteError = !hasInviteCode ? 'Open signup from a valid invite link before creating an account.' : null;
  const displayError = error === inviteError ? inviteError : error;

  return (
    <section className="card signup-card">
      <div className="kicker">Invite-only signup</div>
      <h2>Create your account</h2>
      <p className="muted">Keep signup simple here. Intervals connection happens in the guided onboarding step right after account creation.</p>
      {displayError ? <p className="notice error">{displayError}</p> : null}
      {inviteError && inviteError !== displayError ? <p className="notice error">{inviteError}</p> : null}
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
          <button type="submit" disabled={!hasInviteCode} aria-disabled={!hasInviteCode}>Create account</button>
        </div>
      </form>
    </section>
  );
}
