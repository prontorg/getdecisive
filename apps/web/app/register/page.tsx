import { RegisterPanel } from '../../components/auth/RegisterPanel';
import { validateInviteCodeRecord } from '../../lib/server/auth-store';

export default async function RegisterPage({ searchParams }: { searchParams?: Promise<{ error?: string; email?: string; name?: string; inviteCode?: string }> }) {
  const params = (await searchParams) || {};
  const inviteCheck = params.inviteCode ? await validateInviteCodeRecord(params.inviteCode) : { valid: false, reason: 'Open signup from a valid invite link before creating an account.' };
  const inviteCode = inviteCheck.valid ? params.inviteCode : undefined;
  const error = params.error || (!inviteCheck.valid ? inviteCheck.reason : undefined);
  return (
    <main className="page-shell auth-shell">
      <section className="hero hero-pretty auth-hero">
        <div className="hero-copy auth-hero-copy">
          <div className="kicker">Selective access</div>
          <h1>Private signup</h1>
          <p>Create your decisive account first, then complete the guided Intervals connection in the next onboarding step.</p>
        </div>
      </section>
      <section className="auth-split">
        <RegisterPanel error={error} email={params.email} name={params.name} inviteCode={inviteCode} />
      </section>
    </main>
  );
}
