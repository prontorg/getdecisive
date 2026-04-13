import { RegisterPanel } from '../../components/auth/RegisterPanel';

export default async function RegisterPage({ searchParams }: { searchParams?: Promise<{ error?: string; email?: string; name?: string; inviteCode?: string }> }) {
  const params = (await searchParams) || {};
  return (
    <main className="page-shell auth-shell">
      <section className="hero hero-pretty auth-hero">
        <div className="hero-copy auth-hero-copy">
          <div className="kicker">Selective access</div>
          <h1>Private signup</h1>
          <p>Create the account first, then complete the guided Intervals connection in the next onboarding step.</p>
        </div>
      </section>
      <section className="auth-split">
        <RegisterPanel error={params.error} email={params.email} name={params.name} inviteCode={params.inviteCode} />
      </section>
    </main>
  );
}
