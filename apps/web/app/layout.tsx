import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';

import { AppHeader } from './app/_components/app-header';
import { getMembershipRolesRecord } from '../lib/server/auth-store';
import { getSessionUserId } from '../lib/server/session';

export const metadata: Metadata = {
  title: 'Decisive Planner',
  description: 'Invite-only separate planner platform for decisive.coach',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const userId = await getSessionUserId();
  const roles = userId ? await getMembershipRolesRecord(userId) : [];
  const isAdmin = roles.includes('admin');

  return (
    <html lang="en">
      <body data-app-scope="planner-separate-site">
        <AppHeader loggedIn={Boolean(userId)} isAdmin={isAdmin} />
        {children}
      </body>
    </html>
  );
}
