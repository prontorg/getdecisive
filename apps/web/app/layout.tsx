import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';

import { AppHeader } from './app/_components/app-header';
import { AppLiveRefresh } from './app/_components/app-live-refresh';
import { DeviceLocationSync } from './app/_components/device-location-sync';
import { getMembershipRolesRecord, getUserByIdRecord } from '../lib/server/auth-store';
import { getSessionUserId } from '../lib/server/session';

export const metadata: Metadata = {
  title: 'GET DECISIVE',
  description: 'Invite-only decisive.coach performance platform',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const userId = await getSessionUserId();
  const roles = userId ? await getMembershipRolesRecord(userId) : [];
  const user = userId ? await getUserByIdRecord(userId) : null;
  const isAdmin = roles.includes('admin');

  return (
    <html lang="en">
      <body data-app-scope="decisive-platform">
        <AppLiveRefresh />
        <DeviceLocationSync />
        <AppHeader loggedIn={Boolean(userId)} isAdmin={isAdmin} userDisplayName={user?.displayName || null} userEmail={user?.email || null} />
        {children}
      </body>
    </html>
  );
}
