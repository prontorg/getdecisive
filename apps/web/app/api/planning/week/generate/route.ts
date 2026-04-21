import { NextResponse } from 'next/server';

import { getSessionUserId } from '../../../../../lib/server/session';
import { generateAndActivateWeeklyCycle } from '../../../../../lib/server/planning/planning-store';

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const generated = await generateAndActivateWeeklyCycle(userId);
  if (!generated) return NextResponse.json({ error: 'Planning context unavailable' }, { status: 400 });

  return NextResponse.json(generated);
}
