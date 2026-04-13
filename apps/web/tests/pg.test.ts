import test from 'node:test';
import assert from 'node:assert/strict';

import { isPostgresSyncStoreEnabled } from '../lib/server/pg';

test('isPostgresSyncStoreEnabled reflects DATABASE_URL presence', () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  assert.equal(isPostgresSyncStoreEnabled(), false);
  process.env.DATABASE_URL = 'postgres://example';
  assert.equal(isPostgresSyncStoreEnabled(), true);
  if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
});
