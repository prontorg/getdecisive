import Link from 'next/link';

import { appRoutes } from '../../../lib/routes';

type PlannerTabsProps = {
  active: 'dashboard' | 'analysis' | 'admin';
  isAdmin?: boolean;
};

export function PlannerTabs({ active, isAdmin = false }: PlannerTabsProps) {
  const tabs = [
    { id: 'dashboard', href: appRoutes.dashboard, label: 'Planning', kicker: 'Race-first execution' },
    { id: 'analysis', href: appRoutes.analysis, label: 'Analysis', kicker: 'Individual data view' },
    ...(isAdmin ? [{ id: 'admin', href: appRoutes.admin, label: 'Admin', kicker: 'Invite-only control' }] : []),
  ] as Array<{ id: PlannerTabsProps['active']; href: string; label: string; kicker: string }>;

  return (
    <section className="planner-tabs-shell">
      <div className="planner-tabs-header planner-tabs-header-tight">
        <div>
          <div className="kicker">Decisive planner</div>
          <h2>Keep it simple</h2>
          <p className="planner-tabs-subcopy">One planning tab, one analysis tab, and admin only when you need it.</p>
        </div>
      </div>
      <nav className={`planner-tabs planner-tabs-${tabs.length}`} aria-label="Planner navigation tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Link key={tab.id} href={tab.href} className={`planner-tab${isActive ? ' active' : ''}`}>
              <span className="planner-tab-kicker">{tab.kicker}</span>
              <strong>{tab.label}</strong>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
