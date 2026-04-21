import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const webRoot = process.cwd();
const routePath = join(webRoot, 'app/api/planner/month/workout/route.ts');

test('workout move conflict route redirects form submissions back to plan with conflict details', async () => {
  const source = await readFile(routePath, 'utf8');

  assert.match(source, /code: 'move_conflict'/i);
  assert.match(source, /suggestedDate/i);
  assert.match(source, /searchParams\.set\('moveConflict'/i);
  assert.match(source, /searchParams\.set\('moveConflictReason'/i);
  assert.match(source, /searchParams\.set\('moveConflictSuggestedDate'/i);
  assert.match(source, /searchParams\.set\('notice'/i);
  assert.match(source, /Workout moved to/i);
  assert.match(source, /request\.headers\.get\('content-type'\)/i);
  assert.match(source, /application\/json/i);
});
