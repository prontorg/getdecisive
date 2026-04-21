import { NextResponse } from 'next/server';

const CITY_COOKIE = 'decisive_device_city';
const COUNTRY_COOKIE = 'decisive_device_country';
const LAT_COOKIE = 'decisive_device_lat';
const LON_COOKIE = 'decisive_device_lon';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const latitude = Number(body?.latitude);
  const longitude = Number(body?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

  let city = '';
  let country = '';
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('accept-language', 'en');

    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'decisive-coach/1.0 (+https://decisive.coach)',
      },
    });
    if (response.ok) {
      const payload = await response.json();
      const address = payload?.address || {};
      city = String(address.city || address.town || address.village || address.municipality || address.county || '').trim();
      country = String(address.country || '').trim();
    }
  } catch {
    // fall through to current-location response
  }

  const resolvedCity = city || 'current location';
  const resolvedCountry = city ? country : '';
  const response = NextResponse.json({ ok: true, city: resolvedCity, country: resolvedCountry || null });
  response.cookies.set(CITY_COOKIE, resolvedCity, { path: '/', sameSite: 'lax', maxAge: COOKIE_MAX_AGE_SECONDS });
  response.cookies.set(COUNTRY_COOKIE, resolvedCountry, { path: '/', sameSite: 'lax', maxAge: COOKIE_MAX_AGE_SECONDS });
  response.cookies.set(LAT_COOKIE, String(latitude), { path: '/', sameSite: 'lax', maxAge: COOKIE_MAX_AGE_SECONDS });
  response.cookies.set(LON_COOKIE, String(longitude), { path: '/', sameSite: 'lax', maxAge: COOKIE_MAX_AGE_SECONDS });
  return response;
}
