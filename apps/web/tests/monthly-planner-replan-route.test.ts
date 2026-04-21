import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const webRoot = process.cwd();
const routePath = join(webRoot, 'app/api/planner/month/replan/route.ts');

test('current-week replan route supports scenario-driven partial replanning for form and JSON callers', async () => {
  const source = await readFile(routePath, 'utf8');

  assert.match(source, /missed_session/i);
  assert.match(source, /fatigued/i);
  assert.match(source, /fresher/i);
  assert.match(source, /reduce_load/i);
  assert.match(source, /increase_specificity/i);
  assert.match(source, /replanCurrentWeekForScenario/i);
  assert.match(source, /replaceMonthlyPlanWeek/i);
  assert.match(source, /request\.headers\.get\('content-type'\)/i);
  assert.match(source, /application\/json/i);
  assert.match(source, /NextResponse\.redirect\(new URL\(/i);
  assert.match(source, /Active-week draft bridge updated:/i);
});
