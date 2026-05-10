import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const webRoot = process.cwd();
const routePath = join(webRoot, 'app/api/planner/month/workout/route.ts');

test('workout move route allows same-day stacking while still checking hard-day spacing conflicts', async () => {
  const source = await readFile(routePath, 'utf8');

  assert.match(source, /sameDayConflict:\s*false/i);
  assert.doesNotMatch(source, /same-day conflict with/i);
  assert.match(source, /back-to-back hard-day conflict/i);
  assert.match(source, /const workoutIdentity = plannerSlotId \|\| workoutId/i);
});

test('workout route requires draft revision alignment for json mutations', async () => {
  const source = await readFile(routePath, 'utf8');

  assert.match(source, /expectedDraftRevision/i);
  assert.match(source, /Workout mutation is stale\. Refresh the planner before applying another change\./i);
  assert.match(source, /currentDraftRevision/i);
});
