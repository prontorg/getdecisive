'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const APP_REFRESH_PATHS = new Set(['/app/dashboard', '/app/plan', '/app/calendar']);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function AppLiveRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const lastRefreshAtRef = useRef(0);
  const activeDayRef = useRef(todayIso());

  useEffect(() => {
    if (!pathname || !APP_REFRESH_PATHS.has(pathname)) return;

    const refresh = () => {
      lastRefreshAtRef.current = Date.now();
      activeDayRef.current = todayIso();
      router.refresh();
    };

    const refreshIfStale = () => {
      const now = Date.now();
      const currentDay = todayIso();
      const dayChanged = activeDayRef.current !== currentDay;
      const intervalElapsed = now - lastRefreshAtRef.current >= REFRESH_INTERVAL_MS;
      if (dayChanged || intervalElapsed) refresh();
    };

    const intervalId = window.setInterval(refreshIfStale, REFRESH_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshIfStale();
    };

    window.addEventListener('focus', refreshIfStale);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshIfStale);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [pathname, router]);

  return null;
}
