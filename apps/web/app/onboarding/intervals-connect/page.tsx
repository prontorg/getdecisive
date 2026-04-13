import { IntervalsConnectPanel } from '../../../components/auth/IntervalsConnectPanel';

export default async function IntervalsConnectPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = (await searchParams) || {};
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <div className="kicker">Guided connection</div>
          <h1>Connect Intervals</h1>
          <p>
            This is a separate planner app. The onboarding flow connects Intervals here before the user
            enters the platform.
          </p>
        </div>
      </section>
      <IntervalsConnectPanel error={params.error} />
    </main>
  );
}
