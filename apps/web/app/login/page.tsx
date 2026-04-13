import { LoginPanel } from '../../components/auth/LoginPanel';

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; notice?: string }> }) {
  const params = (await searchParams) || {};
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <div className="kicker">Decisive platform</div>
          <h1>Access decisive</h1>
          <p>One login for the full decisive.coach application. Sign up with an invite first, then connect Intervals in onboarding.</p>
        </div>
      </section>
      <LoginPanel error={params.error} notice={params.notice} />
    </main>
  );
}
