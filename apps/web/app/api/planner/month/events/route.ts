import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../../lib/routes';
import { getSessionUserId } from '../../../../../lib/server/session';
import { listPlanningEvents, savePlanningEvent } from '../../../../../lib/server/planner-customization';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const events = await listPlanningEvents(userId);
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contentType = request.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await request.json() : await request.formData();
  const title = String(isJson ? payload.title : payload.get('title') || '').trim();
  const date = String(isJson ? payload.date : payload.get('date') || '').trim();
  const type = String(isJson ? payload.type : payload.get('type') || 'B_race') as 'A_race' | 'B_race' | 'C_race' | 'training_camp' | 'travel' | 'blackout';
  const priority = String(isJson ? payload.priority : payload.get('priority') || 'support') as 'primary' | 'support' | 'optional';
  const notes = String(isJson ? payload.notes || '' : payload.get('notes') || '').trim();

  if (!title || !date) {
    return NextResponse.json({ error: 'Title and date are required' }, { status: 400 });
  }

  const event = await savePlanningEvent(userId, { title, date, type, priority, notes: notes || undefined });

  if (isJson) {
    return NextResponse.json({ event }, { status: 201 });
  }

  return NextResponse.redirect(new URL(`${appRoutes.planRaces}?notice=Event%20saved`, request.url));
}
