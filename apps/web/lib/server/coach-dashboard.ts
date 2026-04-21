import { cookies, headers } from 'next/headers';

export type CoachDashboardEmbed = {
  styleTag: string;
  bodyInnerHtml: string;
};

export async function fetchCoachDashboardEmbed(userId: string): Promise<CoachDashboardEmbed | null> {
  try {
    const requestHeaders = await headers();
    const requestCookies = await cookies();
    const forwardedFor = requestHeaders.get('x-forwarded-for') || requestHeaders.get('cf-connecting-ip') || '';
    const cookieCity = requestCookies.get('decisive_device_city')?.value || '';
    const cookieCountry = requestCookies.get('decisive_device_country')?.value || '';
    const city = cookieCity || requestHeaders.get('x-vercel-ip-city') || requestHeaders.get('cf-ipcity') || '';
    const country = cookieCity ? cookieCountry : (requestHeaders.get('x-vercel-ip-country') || requestHeaders.get('cf-ipcountry') || cookieCountry || '');
    const latitude = requestCookies.get('decisive_device_lat')?.value || '';
    const longitude = requestCookies.get('decisive_device_lon')?.value || '';

    const response = await fetch('http://127.0.0.1:8765/api/dashboard-html', {
      cache: 'no-store',
      headers: {
        Accept: 'text/html',
        Cookie: `decisive_session_user=${encodeURIComponent(userId)}`,
        'X-Forwarded-For': forwardedFor,
        'X-Device-City': city,
        'X-Device-Country': country,
        'X-Device-Latitude': latitude,
        'X-Device-Longitude': longitude,
      },
    });

    if (!response.ok) return null;
    const html = await response.text();
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (!styleMatch || !bodyMatch) return null;

    return {
      styleTag: styleMatch[1],
      bodyInnerHtml: bodyMatch[1],
    };
  } catch {
    return null;
  }
}
