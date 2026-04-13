import test from 'node:test';
import assert from 'node:assert/strict';

import { getWorkerCommand, getWorkerLogPath } from '../lib/server/sync-worker';

test('getWorkerCommand targets the worker and forwards the shared store path', () => {
  const command = getWorkerCommand('/tmp/decisive-store.json');

  assert.equal(command.command, 'python3');
  assert.equal(command.args.some((item) => item.endsWith('apps/worker/main.py')), true);
  assert.equal(command.args.includes('--store-path'), true);
  assert.equal(command.args.includes('/tmp/decisive-store.json'), true);
  assert.equal(command.env.DECISIVE_PLATFORM_STORE_PATH, '/tmp/decisive-store.json');
});

test('getWorkerLogPath points at the shared worker log file', () => {
  assert.equal(getWorkerLogPath().endsWith('apps/worker/worker.log'), true);
});
