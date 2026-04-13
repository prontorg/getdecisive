export function LoginPanel({ error, notice }: { error?: string; notice?: string }) {
  return (
    <section className="card">
      <div className="kicker">Launch auth</div>
      <h2>Simple account login</h2>
      <p className="muted">Use the email and password from your private invite signup. Access stays intentionally simple for now.</p>
      {error ? <p className="notice error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}
      <form className="form-grid" action="/planner/api/auth/login" method="post">
        <label>
          <span>Email</span>
          <input name="email" type="email" placeholder="you@decisive.coach" required autoComplete="email" />
        </label>
        <label>
          <span>Password</span>
          <input name="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
        </label>
        <div className="button-row">
          <button type="submit">Log in</button>
          <a href="/register" className="button-secondary button-link">Private sign up</a>
        </div>
      </form>
    </section>
  );
}
