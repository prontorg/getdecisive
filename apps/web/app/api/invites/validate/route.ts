import { validateInviteCodeRecord } from '../../../../lib/server/auth-store';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = String(body?.code ?? '').trim();
  const result = await validateInviteCodeRecord(code);
  return Response.json({
    valid: result.valid,
    reason: result.reason || null,
  });
}
