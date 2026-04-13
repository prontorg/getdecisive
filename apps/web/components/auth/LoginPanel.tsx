export function LoginPanel({ error, notice }: { error?: string; notice?: string }) {
  return (
    <section className="card">
      <div className="kicker">Launch auth</div>
      <h2>Email/password + magic link</h2>
      <p className="muted">Already invited? Use your private sign-up link. If not, enroll for beta separately.</p>
      {error ? <p className="notice error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}
      <form className="form-grid" action="/planner/api/auth/login" method="post">
        <label>
          <span>Email</span>
          <input name="email" type="email" placeholder="you@decisive.coach" required />
        </label>
        <label>
          <span>Password</span>
          <input name="password" type="password" placeholder="••••••••" required />
        </label>
        <div className="button-row">
          <button type="submit">Login with password</button>
          <a href="/register" className="button-secondary button-link">Private sign up</a>
        </div>
      </form>
      <form className="form-grid" action="/planner/api/auth/magic-link" method="post" style={{ marginTop: 16 }}>
        <label>
          <span>Email for magic link</span>
          <input name="email" type="email" placeholder="you@decisive.coach" required />
        </label>
        <div className="button-row">
          <button type="submit" className="button-secondary">Send magic link</button>
        </div>
      </form>
    </section>
  );
}
