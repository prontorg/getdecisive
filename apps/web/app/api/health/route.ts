export async function GET() {
  return Response.json({
    ok: true,
    app: 'decisive-platform',
    separateSite: true,
    plannerHost: process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.decisive.coach',
  });
}
