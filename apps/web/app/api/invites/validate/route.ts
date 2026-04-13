export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = String(body?.code ?? '').trim();
  return Response.json({
    valid: code.length >= 6,
    reason: code.length >= 6 ? null : 'Invite code must be at least 6 characters in this scaffold.',
  });
}
