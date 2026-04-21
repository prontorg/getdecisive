import React from 'react';

export function LoginPanel({ error }: { error?: string; notice?: string }) {
  return (
    <section className="card auth-login-card auth-login-card-simple">
      <div className="kicker">Login</div>
      <h2>Get decisive</h2>
      <p className="muted">Use the email and password from your private invite signup.</p>
      {error ? <p className="notice error">{error}</p> : null}
      <form className="form-grid" action="/api/auth/login" method="post">
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
        </div>
      </form>
    </section>
  );
}
