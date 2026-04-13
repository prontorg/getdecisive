import { LoginPanel } from '../../components/auth/LoginPanel';

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; notice?: string }> }) {
  const params = (await searchParams) || {};
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <div className="kicker">Separate planner site</div>
          <h1>Access decisive planner</h1>
          <p>Simple private login for the planner product. Sign up with an invite first, then connect Intervals in onboarding.</p>
        </div>
      </section>
      <LoginPanel error={params.error} notice={params.notice} />
    </main>
  );
}
