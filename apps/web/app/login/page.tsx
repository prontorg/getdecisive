import { LoginPanel } from '../../components/auth/LoginPanel';

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; notice?: string }> }) {
  const params = (await searchParams) || {};
  return (
    <main className="page-shell auth-screen-shell">
      <section className="auth-screen-panel md-surface md-surface-raised">
        <div className="auth-screen-copy">
          <div className="kicker">Decisive platform</div>
          <h1>Access decisive</h1>
          <p>
            One login for the full decisive.coach application. If there is no active session, keep the shell visible,
            send all tab clicks to this page, and let login be the primary fallback.
          </p>
        </div>
        <LoginPanel error={params.error} notice={params.notice} />
      </section>
    </main>
  );
}
