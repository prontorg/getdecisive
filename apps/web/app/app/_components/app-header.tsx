'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { appRoutes } from '../../../lib/routes';

type AppHeaderProps = {
  loggedIn: boolean;
  isAdmin: boolean;
};

export function AppHeader({ loggedIn, isAdmin }: AppHeaderProps) {
  const pathname = usePathname();
  const navItems = [
    { href: loggedIn ? appRoutes.dashboard : appRoutes.login, label: 'Dashboard' },
    { href: loggedIn ? appRoutes.analysis : appRoutes.login, label: 'Training plan' },
    ...(isAdmin ? [{ href: appRoutes.admin, label: 'Settings' }] : []),
  ];

  return (
    <header className="app-topbar md-surface md-surface-raised">
      <div className="app-topbar__inner">
        <div className="app-topbar__brand">
          <Link href={appRoutes.landing} className="app-brand-mark">
            <span className="app-brand-mark__eyebrow">Le ciel est la limite</span>
            <strong>Decisive</strong>
          </Link>
        </div>

        <nav className="app-topbar__nav" aria-label="Primary navigation">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`app-topbar__nav-link${active ? ' active' : ''}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="app-topbar__actions">
          {!loggedIn ? (
            <>
              <Link href={appRoutes.login} className="button-secondary button-link">Log in</Link>
              <Link href={appRoutes.register} className="button-link">Sign up</Link>
            </>
          ) : (
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="button-secondary">Log out</button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
