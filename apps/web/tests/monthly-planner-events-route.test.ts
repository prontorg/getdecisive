import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const webRoot = process.cwd();
const routePath = join(webRoot, 'app/api/planner/month/events/route.ts');

test('planner month events route supports list/create for form and JSON callers', async () => {
  const source = await readFile(routePath, 'utf8');

  assert.match(source, /getSessionUserId/i);
  assert.match(source, /listPlanningEvents/i);
  assert.match(source, /savePlanningEvent/i);
  assert.match(source, /request\.headers\.get\('content-type'\)/i);
  assert.match(source, /application\/json/i);
  assert.match(source, /formData\(/i);
  assert.match(source, /durationHours/i);
  assert.match(source, /appRoutes\.planRaces|appRoutes\.plan/i);
  assert.match(source, /NextResponse\.redirect\(new URL\(/i);
});
