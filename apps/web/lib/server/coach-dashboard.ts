export type CoachDashboardEmbed = {
  styleTag: string;
  bodyInnerHtml: string;
};

export async function fetchCoachDashboardEmbed(): Promise<CoachDashboardEmbed | null> {
  try {
    const response = await fetch('http://127.0.0.1:8765/api/dashboard-html', {
      cache: 'no-store',
      headers: { Accept: 'text/html' },
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
