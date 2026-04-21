import { NextResponse } from 'next/server';

import { getMembershipRolesRecord } from './auth-store';
import { getAuthorizedPlannerLiveContext } from './planner-data';
import { appRoutes } from '../routes';

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

export function redirectWithNotice(route: string, request: Request, path: string, details?: Record<string, unknown>) {
  logRouteEvent(route, 'info', 'Redirecting with notice', { path, ...safeDetails(details) });
  return NextResponse.redirect(new URL(path, request.url));
}

export function redirectWithError(route: string, request: Request, path: string, message: string, details?: Record<string, unknown>) {
  logRouteEvent(route, 'warn', message, { path, ...safeDetails(details) });
  return NextResponse.redirect(new URL(path, request.url));
}

export async function requirePlanningApiAccess(userId: string, route: string) {
  const planner = await getAuthorizedPlannerLiveContext(userId);
  if (!planner) {
    logRouteEvent(route, 'warn', 'Planning API blocked because onboarding or live planner context is unavailable', { userId });
    return null;
  }
  return planner;
}

export async function requireAdminActor(actorUserId: string | null, route: string, request: Request) {
  if (!actorUserId) {
    return {
      allowed: false as const,
      response: redirectWithError(route, request, appRoutes.login, 'Admin mutation blocked because no active session exists'),
    };
  }
  const roles = await getMembershipRolesRecord(actorUserId);
  if (!roles.includes('admin')) {
    return {
      allowed: false as const,
      response: redirectWithError(route, request, appRoutes.dashboard, 'Admin mutation blocked because actor is not an admin', { actorUserId, roles }),
    };
  }
  return { allowed: true as const, roles };
}

export function captureRouteError(route: string, error: unknown, details?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : 'Unexpected route failure';
  logRouteEvent(route, 'error', message, {
    ...safeDetails(details),
    stack: error instanceof Error ? error.stack : undefined,
  });
  return message;
}
