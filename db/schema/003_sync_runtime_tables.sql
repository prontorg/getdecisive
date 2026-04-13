create table if not exists sync_jobs_runtime (
  id text primary key,
  user_id text not null,
  connection_id text not null,
  job_type text not null,
  status text not null,
  progress_pct integer not null default 0,
  status_message text not null default '',
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create index if not exists sync_jobs_runtime_user_updated_idx
  on sync_jobs_runtime (user_id, updated_at desc);

create table if not exists intervals_snapshots_runtime (
  id text primary key,
  user_id text not null,
  connection_id text not null,
  source_job_id text not null,
  captured_at timestamptz not null,
  live_state_json jsonb not null default '{}'::jsonb
);

create index if not exists intervals_snapshots_runtime_user_captured_idx
  on intervals_snapshots_runtime (user_id, captured_at desc);

create unique index if not exists intervals_snapshots_runtime_connection_idx
  on intervals_snapshots_runtime (connection_id);
