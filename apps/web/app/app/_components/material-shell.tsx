import type { ReactNode } from 'react';

export function AppPageShell({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'admin' | 'readable' }) {
  const className = tone === 'admin' ? 'page-shell page-shell-admin' : tone === 'readable' ? 'page-shell page-shell-readable' : 'page-shell';
  return <main className={className}>{children}</main>;
}

export function AppHero({
  eyebrow,
  title,
  description,
  chips,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  chips?: ReactNode;
}) {
  return (
    <section className="md-page-hero md-surface md-surface-hero">
      <div className="md-page-hero__content">
        <div className="kicker">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
        {chips ? <div className="chip-row">{chips}</div> : null}
      </div>
    </section>
  );
}

export function AppMetricStrip({ children }: { children: ReactNode }) {
  return <section className="md-metric-strip">{children}</section>;
}

export function AppMetricCard({ label, value, detail, tone = 'default' }: { label: string; value: ReactNode; detail: ReactNode; tone?: 'default' | 'positive' | 'negative' }) {
  const toneClass = tone === 'positive' ? 'md-metric-card__value-positive' : tone === 'negative' ? 'md-metric-card__value-negative' : '';
  return (
    <div className="md-metric-card md-surface md-surface-raised">
      <div className="kicker">{label}</div>
      <h2 className={toneClass}>{value}</h2>
      <p>{detail}</p>
    </div>
  );
}

export function AppSectionColumns({ children, variant = 'default' }: { children: ReactNode; variant?: 'default' | 'wide' | 'analysis' }) {
  const className = variant === 'wide' ? 'md-section-columns md-section-columns-wide' : variant === 'analysis' ? 'md-section-columns md-section-columns-analysis' : 'md-section-columns';
  return <section className={className}>{children}</section>;
}

export function AppSectionStack({ children }: { children: ReactNode }) {
  return <div className="md-section-stack">{children}</div>;
}

export function AppCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card md-surface md-surface-card ${className}`.trim()}>{children}</section>;
}

export function AppHighlightsGrid({ children }: { children: ReactNode }) {
  return <div className="md-highlights-grid">{children}</div>;
}
