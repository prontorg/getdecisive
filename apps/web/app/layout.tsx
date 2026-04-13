import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Decisive Planner',
  description: 'Invite-only separate planner platform for decisive.coach',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body data-app-scope="planner-separate-site">{children}</body>
    </html>
  );
}
