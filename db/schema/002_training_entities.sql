create table if not exists training_plans (
  id uuid primary key,
  athlete_profile_id uuid not null references athlete_profiles(id),
  title text not null,
  objective text,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft',
  source text not null default 'manual',
  generation_prompt text,
  generation_inputs_json jsonb not null default '{}'::jsonb,
  created_by_membership_id uuid references workspace_memberships(id),
  published_at timestamptz,
  archived_at timestamptz
);

create table if not exists plan_blocks (
  id uuid primary key,
  training_plan_id uuid not null references training_plans(id),
  title text not null,
  theme text,
  start_date date not null,
  end_date date not null,
  notes text,
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists planned_sessions (
  id uuid primary key,
  training_plan_id uuid not null references training_plans(id),
  athlete_profile_id uuid not null references athlete_profiles(id),
  plan_block_id uuid references plan_blocks(id),
  planned_date date not null,
  status text not null default 'planned',
  session_type text not null,
  title text not null,
  summary text,
  structure_json jsonb not null default '{}'::jsonb,
  targets_json jsonb not null default '{}'::jsonb,
  duration_minutes integer,
  export_defaults_json jsonb not null default '{}'::jsonb,
  visual_guidance_json jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  locked_by_user boolean not null default false,
  created_by_membership_id uuid references workspace_memberships(id),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists completed_sessions (
  id uuid primary key,
  athlete_profile_id uuid not null references athlete_profiles(id),
  planned_session_id uuid references planned_sessions(id),
  intervals_connection_id uuid references intervals_connections(id),
  external_activity_id text,
  occurred_at timestamptz not null,
  metrics_json jsonb not null default '{}'::jsonb,
  analysis_json jsonb not null default '{}'::jsonb,
  compliance_status text,
  created_at timestamptz not null default now()
);

create table if not exists workout_exports (
  id uuid primary key,
  planned_session_id uuid not null references planned_sessions(id),
  export_format text not null,
  status text not null default 'pending',
  artifact_path text,
  artifact_meta_json jsonb not null default '{}'::jsonb,
  generated_at timestamptz,
  delivered_at timestamptz
);

create table if not exists dashboard_snapshots (
  id uuid primary key,
  athlete_profile_id uuid not null references athlete_profiles(id),
  snapshot_date date not null,
  metrics_json jsonb not null default '{}'::jsonb,
  recommendation_json jsonb not null default '{}'::jsonb,
  calendar_summary_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (athlete_profile_id, snapshot_date)
);

create table if not exists daily_checkins (
  id uuid primary key,
  athlete_profile_id uuid not null references athlete_profiles(id),
  checkin_date date not null,
  legs_score integer,
  sleep_score integer,
  soreness_score integer,
  motivation_score integer,
  illness_flag boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  unique (athlete_profile_id, checkin_date)
);
