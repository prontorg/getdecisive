'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { appRoutes } from '../../../lib/routes';

type AppHeaderProps = {
  loggedIn: boolean;
  isAdmin: boolean;
  userDisplayName?: string | null;
  userEmail?: string | null;
};

export function AppHeader({ loggedIn, isAdmin, userDisplayName, userEmail }: AppHeaderProps) {
  const pathname = usePathname();
  const hideNavForAuthScreen = pathname === appRoutes.login || pathname === appRoutes.register;
  const navItems = [
    { href: loggedIn ? appRoutes.dashboard : appRoutes.login, label: 'Insight' },
    { href: loggedIn ? appRoutes.plan : appRoutes.login, label: 'Plan' },
  ];

  return (
    <header className="app-topbar md-surface md-surface-raised">
      <div className="app-topbar__inner">
        <div className="app-topbar__brand app-topbar__brand-expanded">
          <Link href={appRoutes.landing} className="app-brand-mark app-brand-mark-stacked">
            <div className="app-topbar__brand-title">GET DECISIVE</div>
            <span className="app-brand-mark__eyebrow">AI Coaching for the people</span>
          </Link>
        </div>

        {!hideNavForAuthScreen ? (
          <nav className="app-topbar__nav" aria-label="Primary navigation">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} prefetch={loggedIn} className={`app-topbar__nav-link${active ? ' active' : ''}`}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : null}

        {!hideNavForAuthScreen ? (
          <div className="app-topbar__actions">
            {!loggedIn ? (
              <>
                <Link href={appRoutes.login} className="button-secondary button-link">Log in</Link>
                <Link href={appRoutes.register} className="button-link">Sign up</Link>
              </>
            ) : (
              <>
                {(userDisplayName || userEmail) ? (
                  <span className="app-topbar__user-label">{userDisplayName && userEmail ? `${userDisplayName} - ${userEmail}` : userDisplayName || userEmail || ''}</span>
                ) : null}
                <Link href={appRoutes.account} className="button-secondary button-link" prefetch={false}>
                  Config
                </Link>
                <form action="/api/auth/logout" method="post">
                  <button type="submit" className="button-secondary button-link">Log out</button>
                </form>
              </>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
