import React from 'react';

export function LoginPanel({ error }: { error?: string; notice?: string }) {
  return (
    <section className="card auth-login-card auth-login-card-simple auth-login-card-m3">
      <div className="auth-login-card__header">
        <div className="kicker">Login</div>
        <h2>Get decisive</h2>
        <p className="muted">Use the email and password from your private invite signup.</p>
      </div>
      {error ? <p className="notice error">{error}</p> : null}
      <form className="form-grid auth-login-form" action="/api/auth/login" method="post">
        <label>
          <span>Email</span>
          <input name="email" type="email" placeholder="you@decisive.coach" required autoComplete="email" />
        </label>
        <label>
          <span>Password</span>
          <input name="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
        </label>
        <div className="button-row auth-login-actions">
          <button type="submit" className="auth-login-submit">Log in</button>
        </div>
      </form>
    </section>
  );
}
