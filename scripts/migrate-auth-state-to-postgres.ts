import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { migratePlatformStateToPostgres } from '../apps/web/lib/server/auth-store.ts';

async function main() {
  const rootDir = path.resolve(new URL('..', import.meta.url).pathname);
  const storePath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : process.env.DECISIVE_PLATFORM_STORE_PATH
      ? path.resolve(process.cwd(), process.env.DECISIVE_PLATFORM_STORE_PATH)
      : path.join(rootDir, 'apps/web/.decisive-dev-store.json');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const storeRaw = await readFile(storePath, 'utf8');
  const sourceState = JSON.parse(storeRaw);
  const result = await migratePlatformStateToPostgres(sourceState);
  console.log(JSON.stringify({ storePath, ...result }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
