import { spawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';

function workspaceRoot() {
  return join(process.cwd(), '..', '..');
}

export function getWorkerLogPath() {
  return join(workspaceRoot(), 'apps', 'worker', 'worker.log');
}

export function getWorkerCommand(storePath?: string) {
  return {
    command: 'python3',
    args: [join(workspaceRoot(), 'apps', 'worker', 'main.py'), 'run-next', ...(storePath ? ['--store-path', storePath] : [])],
    cwd: workspaceRoot(),
    env: {
      ...process.env,
      ...(storePath ? { DECISIVE_PLATFORM_STORE_PATH: storePath } : {}),
    },
  };
}

export function triggerSyncWorker(storePath?: string) {
  const cmd = getWorkerCommand(storePath);
  const logPath = getWorkerLogPath();
  mkdirSync(join(workspaceRoot(), 'apps', 'worker'), { recursive: true });
  const stdout = openSync(logPath, 'a');
  const child = spawn(cmd.command, cmd.args, {
    cwd: cmd.cwd,
    env: cmd.env,
    detached: true,
    stdio: ['ignore', stdout, stdout],
  });
  if (!child.pid) {
    throw new Error(`Failed to launch sync worker. Check ${logPath}`);
  }
  child.unref();
  return { pid: child.pid, logPath };
}
