export default function AppLoading() {
  return (
    <main className="page-shell">
      <section className="md-page-hero md-surface md-surface-hero app-loading-block">
        <div className="md-page-hero__content">
          <div className="app-loading-line app-loading-line-sm" />
          <div className="app-loading-line app-loading-line-lg" />
          <div className="app-loading-line app-loading-line-md" />
        </div>
      </section>

      <section className="md-metric-strip">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="md-metric-card md-surface md-surface-raised app-loading-block">
            <div className="app-loading-line app-loading-line-sm" />
            <div className="app-loading-line app-loading-line-md" />
            <div className="app-loading-line app-loading-line-sm" />
          </div>
        ))}
      </section>
    </main>
  );
}
