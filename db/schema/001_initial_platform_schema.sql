-- Decisive platform initial schema draft

create table if not exists users (
  id uuid primary key,
  email text not null unique,
  password_hash text,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists workspaces (
  id uuid primary key,
  name text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists workspace_memberships (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id),
  user_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists workspace_membership_roles (
  id uuid primary key,
  membership_id uuid not null references workspace_memberships(id),
  role_key text not null,
  unique (membership_id, role_key)
);

create table if not exists athlete_profiles (
  id uuid primary key,
  user_id uuid references users(id),
  workspace_id uuid not null references workspaces(id),
  display_name text not null,
  timezone text not null default 'Europe/Zurich',
  discipline_focus text,
  threshold_w integer,
  defaults_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists coach_athlete_links (
  id uuid primary key,
  coach_membership_id uuid not null references workspace_memberships(id),
  athlete_profile_id uuid not null references athlete_profiles(id),
  created_at timestamptz not null default now(),
  unique (coach_membership_id, athlete_profile_id)
);

create table if not exists invite_codes (
  id uuid primary key,
  code_hash text not null unique,
  created_by_membership_id uuid not null references workspace_memberships(id),
  max_uses integer not null default 1,
  used_count integer not null default 0,
  expires_at timestamptz,
  status text not null default 'active',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists invite_redemptions (
  id uuid primary key,
  invite_code_id uuid not null references invite_codes(id),
  redeemed_by_user_id uuid not null references users(id),
  redeemed_at timestamptz not null default now()
);

create table if not exists intervals_connections (
  id uuid primary key,
  athlete_profile_id uuid not null references athlete_profiles(id),
  auth_mode text not null,
  credential_ref text not null,
  external_athlete_id text,
  sync_status text not null default 'pending',
  last_sync_started_at timestamptz,
  last_sync_completed_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists onboarding_runs (
  id uuid primary key,
  user_id uuid not null references users(id),
  athlete_profile_id uuid references athlete_profiles(id),
  state text not null,
  progress_pct integer not null default 0,
  status_message text,
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists audit_events (
  id uuid primary key,
  workspace_id uuid references workspaces(id),
  actor_user_id uuid references users(id),
  actor_membership_id uuid references workspace_memberships(id),
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
