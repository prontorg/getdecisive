import { NextResponse } from 'next/server';

import { appRoutes } from '../../../../../lib/routes';
import { getSessionUserId } from '../../../../../lib/server/session';
import { listPlanningEvents, removePlanningEvent, savePlanningEvent, updatePlanningEvent } from '../../../../../lib/server/planner-customization';

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
  const action = String(isJson ? payload.action || 'save' : payload.get('action') || 'save').trim();
  const eventId = String(isJson ? payload.eventId || '' : payload.get('eventId') || '').trim();
  const title = String(isJson ? payload.title : payload.get('title') || '').trim();
  const date = String(isJson ? payload.date : payload.get('date') || '').trim();
  const type = String(isJson ? payload.type : payload.get('type') || 'B_race') as 'A_race' | 'B_race' | 'C_race' | 'training_camp' | 'travel' | 'blackout';
  const priority = String(isJson ? payload.priority : payload.get('priority') || 'support') as 'primary' | 'support' | 'optional';
  const durationHoursRaw = String(isJson ? payload.durationHours || '' : payload.get('durationHours') || '').trim();
  const durationHours = durationHoursRaw ? Number(durationHoursRaw) : undefined;
  const notes = String(isJson ? payload.notes || '' : payload.get('notes') || '').trim();
  const returnTo = String(isJson ? payload.returnTo || '' : payload.get('returnTo') || '').trim();

  if (action === 'remove') {
    if (!eventId) {
      return NextResponse.json({ error: 'Event id is required' }, { status: 400 });
    }

    await removePlanningEvent(userId, eventId);

    if (isJson) {
      return NextResponse.json({ success: true, removedEventId: eventId });
    }

    const nextPath = returnTo === appRoutes.plan ? appRoutes.plan : appRoutes.planRaces;
    return NextResponse.redirect(new URL(`${nextPath}?notice=Event%20removed`, request.url));
  }

  if (!title || !date) {
    return NextResponse.json({ error: 'Title and date are required' }, { status: 400 });
  }

  const event = action === 'update' && eventId
    ? await updatePlanningEvent(userId, eventId, {
      title,
      date,
      type,
      priority,
      durationHours: Number.isFinite(durationHours) ? durationHours : undefined,
      notes: notes || undefined,
    })
    : await savePlanningEvent(userId, {
      title,
      date,
      type,
      priority,
      durationHours: Number.isFinite(durationHours) ? durationHours : undefined,
      notes: notes || undefined,
    });

  if (action === 'update' && !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  if (isJson) {
    return NextResponse.json({ event }, { status: action === 'update' ? 200 : 201 });
  }

  const nextPath = returnTo === appRoutes.plan ? appRoutes.plan : appRoutes.planRaces;
  const notice = action === 'update' ? 'Event%20updated' : 'Event%20saved';
  return NextResponse.redirect(new URL(`${nextPath}?notice=${notice}`, request.url));
}
