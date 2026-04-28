import React from 'react';

export function LoginPanel({ error }: { error?: string; notice?: string }) {
  return (
    <section className="card auth-login-card auth-login-card-simple auth-login-card-m3 auth-login-card-premium">
      <div className="auth-login-card__header">
        <div className="kicker">Login</div>
        <h2>Get decisive</h2>
        <p className="muted">Use the email and password from your private invite signup.</p>
      </div>
      {error ? <p className="notice error">{error}</p> : null}
      <form className="form-grid auth-login-form auth-login-form-premium" action="/api/auth/login" method="post">
        <label>
          <span>Email</span>
          <input className="input-premium" name="email" type="email" placeholder="you@decisive.coach" required autoComplete="email" />
        </label>
        <label>
          <span>Password</span>
          <input className="input-premium" name="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
        </label>
        <div className="button-row auth-login-actions">
          <button type="submit" className="auth-login-submit button-primary-premium">Log in</button>
        </div>
      </form>
    </section>
  );
}
