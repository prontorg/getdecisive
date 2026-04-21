import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const webRoot = process.cwd();

const observedRoutes = [
  'app/api/planner/month/draft/route.ts',
  'app/api/planner/month/replan/route.ts',
  'app/api/planner/month/workout/route.ts',
  'app/api/planner/month/week/route.ts',
  'app/api/planner/month/publish/route.ts',
  'app/api/onboarding/intervals-connect/route.ts',
  'app/api/admin/users/save/route.ts',
];

test('high-value mutation routes use shared route observability helpers', async () => {
  for (const routeFile of observedRoutes) {
    const source = await readFile(join(webRoot, routeFile), 'utf8');
    assert.match(source, /route-observability/i, routeFile);
    assert.match(source, /captureRouteError|logRouteEvent|routeErrorResponse|redirectWithNotice|redirectWithError/i, routeFile);
  }
});
