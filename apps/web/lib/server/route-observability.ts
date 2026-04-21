import { NextResponse } from 'next/server';

import { getAuthorizedPlannerLiveContext } from './planner-data';

export type RouteLogLevel = 'info' | 'warn' | 'error';

function safeDetails(details?: Record<string, unknown>) {
  if (!details) return {};
  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined));
}

export function logRouteEvent(route: string, level: RouteLogLevel, message: string, details?: Record<string, unknown>) {
  const payload = {
    scope: 'decisive-platform',
    route,
    message,
    ...safeDetails(details),
  };
  const line = `[${route}] ${message}`;
  if (level === 'error') {
    console.error(line, payload);
    return;
  }
  if (level === 'warn') {
    console.warn(line, payload);
    return;
  }
  console.info(line, payload);
}

export function routeErrorResponse(route: string, status: number, message: string, details?: Record<string, unknown>) {
  logRouteEvent(route, status >= 500 ? 'error' : 'warn', message, details);
  return NextResponse.json({ error: message }, { status });
}

export async function requirePlanningApiAccess(userId: string, route: string) {
  const planner = await getAuthorizedPlannerLiveContext(userId);
  if (!planner) {
    logRouteEvent(route, 'warn', 'Planning API blocked because onboarding or live planner context is unavailable', { userId });
    return null;
  }
  return planner;
}

export function captureRouteError(route: string, error: unknown, details?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : 'Unexpected route failure';
  logRouteEvent(route, 'error', message, {
    ...safeDetails(details),
    stack: error instanceof Error ? error.stack : undefined,
  });
  return message;
}
