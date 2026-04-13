import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDatabaseUrl(): string | null {
  return process.env.DATABASE_URL || null;
}

export function isPostgresSyncStoreEnabled(): boolean {
  return Boolean(getDatabaseUrl());
}

export function getPgPool(): Pool {
  const connectionString = getDatabaseUrl();
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  if (!pool) {
    pool = new Pool({ connectionString });
  }
  return pool;
}
