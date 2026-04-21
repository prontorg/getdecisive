'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const STORAGE_KEY = 'decisive-device-location-sync-v1';

function readCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1] || '') : '';
}

export function DeviceLocationSync() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.geolocation) return;

    const city = readCookie('decisive_device_city').trim().toLowerCase();
    const hasCoords = Boolean(readCookie('decisive_device_lat') && readCookie('decisive_device_lon'));
    const staleLocation = !city || city === 'current location' || !hasCoords;
    const alreadyRequested = window.sessionStorage.getItem(STORAGE_KEY);
    if (!staleLocation && alreadyRequested) return;
    if (alreadyRequested === 'denied') return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        window.sessionStorage.setItem(STORAGE_KEY, 'requested');
        try {
          const response = await fetch('/api/device-location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
            credentials: 'same-origin',
          });
          if (response.ok && pathname?.startsWith('/app')) {
            router.refresh();
          }
        } catch {
          // best effort only
        }
      },
      () => {
        window.sessionStorage.setItem(STORAGE_KEY, 'denied');
      },
      { enableHighAccuracy: false, maximumAge: staleLocation ? 0 : 30 * 60 * 1000, timeout: 8000 },
    );
  }, [pathname, router]);

  return null;
}
