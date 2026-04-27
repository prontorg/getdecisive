import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const webRoot = process.cwd();
const routePath = join(webRoot, 'app/api/planner/month/publish/route.ts');

test('monthly publish route keeps future-only publish semantics explicit', async () => {
  const source = await readFile(routePath, 'utf8');

  assert.match(source, /getAuthorizedPlannerLiveContext/i);
  assert.match(source, /publishMonthlyPlanDraftLocally\(userId, draftId, publishToday\)/i);
  assert.match(source, /publishToday/i);
  assert.match(source, /Monthly draft future weeks published locally/i);
  assert.match(source, /Future draft published locally/i);
});
