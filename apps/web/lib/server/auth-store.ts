import type { PlatformRole } from '@decisive/types';
import { createHash, randomUUID } from 'node:crypto';

import { getPgPool, isPostgresSyncStoreEnabled } from './pg';
import { loadPlatformState, savePlatformState } from './dev-store';
import { hashPassword, isPasswordHash, verifyPassword } from './auth-password';
import type {
  AuditEventRecord,
  IntervalsConnectionRecord,
  InviteRecord,
  MembershipRecord,
  OnboardingRunRecord,
  PlatformState,
  RegisterInput,
  UserRecord,
} from './platform-state';
import { createSeedPlatformState, deriveOnboardingStatus } from './platform-state';
import { getLatestSnapshotForUser, getLatestSyncJobForUser } from './sync-store';

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyPlatformState(): PlatformState {
  return {
    ...createSeedPlatformState(),
    invites: [],
  };
}

function stableUuid(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16] || '0', 16) % 4] || '8';
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20, 32).join('')}`;
}

function toDbUuid(id: string, entity: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : stableUuid(`${entity}:${id}`);
}

function mapUserRow(row: any): UserRecord {
  return {
    id: String(row.id),
    email: row.email,
    displayName: row.display_name,
    password: row.password_hash,
    workspaceId: String(row.workspace_id),
  };
}

function mapOnboardingRow(row: any): OnboardingRunRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    state: row.state,
    progressPct: row.progress_pct,
    statusMessage: row.status_message,
    syncStartedAt: row.details_json?.syncStartedAt,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function mapConnectionRow(row: any): IntervalsConnectionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    externalAthleteId: row.external_athlete_id,
    credentialPayload: row.credential_ref,
    connectionLabel: row.connection_label || undefined,
    syncStatus: row.sync_status,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  };
}

function mapAuditRow(row: any): AuditEventRecord {
  return {
    id: String(row.id),
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  };
}

export async function getPlatformState(): Promise<PlatformState> {
  if (!isPostgresSyncStoreEnabled()) {
    return loadPlatformState();
  }

  const state = createEmptyPlatformState();
  const pool = getPgPool();
  const [
    usersResult,
    membershipsResult,
    rolesResult,
    invitesResult,
    onboardingResult,
    connectionsResult,
    auditResult,
    latestJobsResult,
    latestSnapshotsResult,
  ] = await Promise.all([
    pool.query(`
      select users.id, users.email, users.password_hash, users.display_name, workspace_memberships.workspace_id
      from users
      left join workspace_memberships on workspace_memberships.user_id = users.id
    `),
    pool.query(`select id, workspace_id, user_id from workspace_memberships`),
    pool.query(`select membership_id, role_key from workspace_membership_roles`),
    pool.query(`select id, code_hash, status, max_uses, used_count from invite_codes`),
    pool.query(`select id, user_id, state, progress_pct, status_message, details_json, updated_at from onboarding_runs`),
    pool.query(`
      select intervals_connections.id, athlete_profiles.user_id, intervals_connections.external_athlete_id,
             intervals_connections.credential_ref, intervals_connections.sync_status, intervals_connections.created_at,
             athlete_profiles.display_name as connection_label
      from intervals_connections
      join athlete_profiles on athlete_profiles.id = intervals_connections.athlete_profile_id
    `),
    pool.query(`select id, event_type, entity_type, entity_id, created_at from audit_events order by created_at desc limit 200`),
    pool.query(`
      select distinct on (user_id) id, user_id, connection_id, job_type, status, progress_pct, status_message, started_at, finished_at, last_error, updated_at
      from sync_jobs_runtime
      order by user_id, updated_at desc
    `),
    pool.query(`
      select distinct on (user_id, connection_id) id, user_id, connection_id, source_job_id, captured_at, live_state_json
      from intervals_snapshots_runtime
      order by user_id, connection_id, captured_at desc
    `),
  ]);

  const rolesByMembership = new Map<string, string[]>();
  for (const row of rolesResult.rows) {
    const membershipId = String(row.membership_id);
    const existing = rolesByMembership.get(membershipId) || [];
    existing.push(row.role_key);
    rolesByMembership.set(membershipId, existing);
  }

  state.users = usersResult.rows.map(mapUserRow);
  state.memberships = membershipsResult.rows.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    userId: String(row.user_id),
    roles: (rolesByMembership.get(String(row.id)) || []) as PlatformRole[],
  }));
  state.invites = invitesResult.rows.map((row) => ({
    id: String(row.id),
    code: row.code_hash,
    status: row.status,
    maxUses: row.max_uses,
    usedCount: row.used_count,
  }));
  state.onboardingRuns = onboardingResult.rows.map(mapOnboardingRow);
  state.intervalsConnections = connectionsResult.rows.map(mapConnectionRow);
  state.auditEvents = auditResult.rows.map(mapAuditRow);
  state.syncJobs = latestJobsResult.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    connectionId: row.connection_id,
    jobType: row.job_type,
    status: row.status,
    progressPct: row.progress_pct,
    statusMessage: row.status_message,
    startedAt: row.started_at?.toISOString?.() || row.started_at || undefined,
    finishedAt: row.finished_at?.toISOString?.() || row.finished_at || undefined,
    lastError: row.last_error || undefined,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  }));
  state.intervalsSnapshots = latestSnapshotsResult.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    connectionId: row.connection_id,
    sourceJobId: row.source_job_id,
    capturedAt: row.captured_at?.toISOString?.() || row.captured_at,
    liveState: row.live_state_json,
  }));
  return state;
}

export async function savePlatformAuthState(state: PlatformState): Promise<void> {
  await savePlatformState(state);
}

export async function validateInviteCodeRecord(code: string): Promise<{ valid: boolean; reason?: string }> {
  const normalized = code.trim();
  if (!isPostgresSyncStoreEnabled()) {
    const state = await loadPlatformState();
    const invite = state.invites.find((item) => item.code === normalized);
    if (!invite) return { valid: false, reason: 'Invite code not found' };
    if (invite.status !== 'active') return { valid: false, reason: 'Invite code is not active' };
    if (invite.usedCount >= invite.maxUses) return { valid: false, reason: 'Invite code already used' };
    return { valid: true };
  }

  const result = await getPgPool().query(
    `select id, status, max_uses, used_count from invite_codes where code_hash = $1 limit 1`,
    [normalized],
  );
  const invite = result.rows[0];
  if (!invite) return { valid: false, reason: 'Invite code not found' };
  if (invite.status !== 'active') return { valid: false, reason: 'Invite code is not active' };
  if (invite.used_count >= invite.max_uses) return { valid: false, reason: 'Invite code already used' };
  return { valid: true };
}

export async function listInviteRecords(): Promise<InviteRecord[]> {
  const state = await getPlatformState();
  return [...state.invites].sort((a, b) => a.id.localeCompare(b.id));
}

export async function createInviteRecord(actorUserId: string, input: { code?: string; maxUses?: number }): Promise<InviteRecord> {
  const normalizedCode = (input.code || `DECISIVE-${randomUUID().slice(0, 8).toUpperCase()}`).trim().toUpperCase();
  const maxUses = Math.max(1, Number(input.maxUses || 1));
  if (!normalizedCode) throw new Error('Invite code is required');

  if (!isPostgresSyncStoreEnabled()) {
    const state = await loadPlatformState();
    if (state.invites.some((invite) => invite.code === normalizedCode)) throw new Error('Invite code already exists');
    const invite: InviteRecord = {
      id: makeId('invite'),
      code: normalizedCode,
      status: 'active',
      maxUses,
      usedCount: 0,
    };
    state.invites.push(invite);
    state.auditEvents.push({ id: makeId('audit'), eventType: 'invite.created', entityType: 'invite', entityId: invite.id, createdAt: nowIso() });
    await savePlatformState(state);
    return invite;
  }

  const membershipResult = await getPgPool().query(
    `select id from workspace_memberships where user_id = $1 order by created_at asc limit 1`,
    [actorUserId],
  );
  const membershipId = membershipResult.rows[0]?.id;
  if (!membershipId) throw new Error('Admin membership not found');

  const invite: InviteRecord = {
    id: randomUUID(),
    code: normalizedCode,
    status: 'active',
    maxUses,
    usedCount: 0,
  };
  await getPgPool().query(
    `insert into invite_codes (id, code_hash, created_by_membership_id, max_uses, used_count, status)
     values ($1,$2,$3,$4,$5,$6)`,
    [invite.id, invite.code, membershipId, invite.maxUses, invite.usedCount, invite.status],
  );
  await getPgPool().query(
    `insert into audit_events (id, actor_user_id, actor_membership_id, event_type, entity_type, entity_id, payload_json)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [randomUUID(), actorUserId, membershipId, 'invite.created', 'invite', invite.id, JSON.stringify({ code: invite.code, maxUses })],
  );
  return invite;
}

export async function revokeInviteRecord(actorUserId: string, inviteId: string): Promise<InviteRecord> {
  if (!inviteId.trim()) throw new Error('Invite id is required');

  if (!isPostgresSyncStoreEnabled()) {
    const state = await loadPlatformState();
    const invite = state.invites.find((item) => item.id === inviteId) || null;
    if (!invite) throw new Error('Invite not found');
    invite.status = 'revoked';
    state.auditEvents.push({ id: makeId('audit'), eventType: 'invite.revoked', entityType: 'invite', entityId: invite.id, createdAt: nowIso() });
    await savePlatformState(state);
    return invite;
  }

  const membershipResult = await getPgPool().query(
    `select id from workspace_memberships where user_id = $1 order by created_at asc limit 1`,
    [actorUserId],
  );
  const membershipId = membershipResult.rows[0]?.id;
  if (!membershipId) throw new Error('Admin membership not found');

  const result = await getPgPool().query(
    `update invite_codes set status = 'revoked' where id = $1 returning id, code_hash, status, max_uses, used_count`,
    [inviteId],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Invite not found');
  await getPgPool().query(
    `insert into audit_events (id, actor_user_id, actor_membership_id, event_type, entity_type, entity_id, payload_json)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [randomUUID(), actorUserId, membershipId, 'invite.revoked', 'invite', row.id, JSON.stringify({ code: row.code_hash })],
  );
  return { id: row.id, code: row.code_hash, status: row.status, maxUses: row.max_uses, usedCount: row.used_count };
}

export async function registerUserWithInviteRecord(input: RegisterInput): Promise<{
  user: UserRecord;
  membership: MembershipRecord;
  onboarding: OnboardingRunRecord;
}> {
  const inviteResult = await validateInviteCodeRecord(input.inviteCode);
  if (!inviteResult.valid) throw new Error(inviteResult.reason || 'Invalid invite code');

  const email = normalizeEmail(input.email);
  if (!email) throw new Error('Email is required');
  if (!input.password.trim()) throw new Error('Password is required');
  if (!input.displayName.trim()) throw new Error('Display name is required');

  if (!isPostgresSyncStoreEnabled()) {
    const state = await loadPlatformState();
    if (state.users.some((user) => user.email === email)) throw new Error('Email already exists');
    const workspaceId = makeId('workspace');
    const user: UserRecord = { id: makeId('user'), email, displayName: input.displayName.trim(), password: hashPassword(input.password.trim()), workspaceId };
    const membership: MembershipRecord = { id: makeId('membership'), userId: user.id, workspaceId, roles: ['athlete'] };
    const onboarding: OnboardingRunRecord = { id: makeId('onboard'), userId: user.id, state: 'account_created', progressPct: 15, statusMessage: 'Account created. Intervals connection required next.', updatedAt: nowIso() };
    state.users.push(user);
    state.memberships.push(membership);
    state.onboardingRuns.push(onboarding);
    const invite = state.invites.find((item) => item.code === input.inviteCode.trim());
    if (invite) invite.usedCount += 1;
    state.auditEvents.push({ id: makeId('audit'), eventType: 'user.registered', entityType: 'user', entityId: user.id, createdAt: nowIso() });
    await savePlatformState(state);
    return { user, membership, onboarding };
  }

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const existing = await client.query(`select id from users where email = $1 limit 1`, [email]);
    if (existing.rows[0]) throw new Error('Email already exists');

    const userId = randomUUID();
    const workspaceId = randomUUID();
    const membershipId = randomUUID();
    const onboardingId = randomUUID();
    const membershipRoleId = randomUUID();
    const hashed = hashPassword(input.password.trim());

    await client.query(`insert into users (id, email, password_hash, display_name) values ($1,$2,$3,$4)`, [userId, email, hashed, input.displayName.trim()]);
    await client.query(`insert into workspaces (id, name, created_by) values ($1,$2,$3)`, [workspaceId, `${input.displayName.trim()} workspace`, userId]);
    await client.query(`insert into workspace_memberships (id, workspace_id, user_id) values ($1,$2,$3)`, [membershipId, workspaceId, userId]);
    await client.query(`insert into workspace_membership_roles (id, membership_id, role_key) values ($1,$2,$3)`, [membershipRoleId, membershipId, 'athlete']);
    await client.query(
      `insert into onboarding_runs (id, user_id, state, progress_pct, status_message, updated_at) values ($1,$2,$3,$4,$5,$6)`,
      [onboardingId, userId, 'account_created', 15, 'Account created. Intervals connection required next.', nowIso()],
    );
    await client.query(`update invite_codes set used_count = used_count + 1 where code_hash = $1`, [input.inviteCode.trim()]);
    await client.query(`insert into audit_events (id, workspace_id, actor_user_id, event_type, entity_type, entity_id, payload_json) values ($1,$2,$3,$4,$5,$6,$7::jsonb)`, [
      randomUUID(),
      workspaceId,
      userId,
      'user.registered',
      'user',
      userId,
      JSON.stringify({ email }),
    ]);
    await client.query('commit');

    return {
      user: { id: userId, email, displayName: input.displayName.trim(), password: hashed, workspaceId },
      membership: { id: membershipId, userId, workspaceId, roles: ['athlete'] },
      onboarding: { id: onboardingId, userId, state: 'account_created', progressPct: 15, statusMessage: 'Account created. Intervals connection required next.', updatedAt: nowIso() },
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function loginWithPasswordRecord(email: string, password: string): Promise<UserRecord | null> {
  const normalized = normalizeEmail(email);
  if (!isPostgresSyncStoreEnabled()) {
    const state = await loadPlatformState();
    const user = state.users.find((entry) => entry.email === normalized) || null;
    if (!user || !verifyPassword(password, user.password)) return null;
    if (!isPasswordHash(user.password)) {
      user.password = hashPassword(password.trim());
      await savePlatformState(state);
    }
    return user;
  }

  const result = await getPgPool().query(
    `select users.id, users.email, users.password_hash, users.display_name, workspace_memberships.workspace_id
     from users
     left join workspace_memberships on workspace_memberships.user_id = users.id
     where users.email = $1
     limit 1`,
    [normalized],
  );
  const row = result.rows[0];
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return mapUserRow(row);
}

export async function getUserByIdRecord(userId: string): Promise<UserRecord | null> {
  if (!isPostgresSyncStoreEnabled()) {
    const state = await loadPlatformState();
    return state.users.find((user) => user.id === userId) || null;
  }
  const result = await getPgPool().query(
    `select users.id, users.email, users.password_hash, users.display_name, workspace_memberships.workspace_id
     from users
     left join workspace_memberships on workspace_memberships.user_id = users.id
     where users.id = $1
     limit 1`,
    [userId],
  );
  const row = result.rows[0];
  return row ? mapUserRow(row) : null;
}

export async function getOnboardingRunRecord(userId: string): Promise<OnboardingRunRecord | null> {
  if (!isPostgresSyncStoreEnabled()) {
    const state = await loadPlatformState();
    return state.onboardingRuns.find((item) => item.userId === userId) || null;
  }
  const result = await getPgPool().query(
    `select id, user_id, state, progress_pct, status_message, details_json, updated_at from onboarding_runs where user_id = $1 order by updated_at desc limit 1`,
    [userId],
  );
  const row = result.rows[0];
  return row ? mapOnboardingRow(row) : null;
}

export async function getMembershipRolesRecord(userId: string): Promise<string[]> {
  if (!isPostgresSyncStoreEnabled()) {
    const state = await loadPlatformState();
    return state.memberships.find((membership) => membership.userId === userId)?.roles || [];
  }
  const result = await getPgPool().query(
    `select workspace_membership_roles.role_key
     from workspace_memberships
     join workspace_membership_roles on workspace_membership_roles.membership_id = workspace_memberships.id
     where workspace_memberships.user_id = $1`,
    [userId],
  );
  return result.rows.map((row) => row.role_key);
}

export async function getLatestIntervalsConnectionRecord(userId: string): Promise<IntervalsConnectionRecord | null> {
  if (!isPostgresSyncStoreEnabled()) {
    const state = await loadPlatformState();
    return state.intervalsConnections
      .filter((connection) => connection.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
  }
  const result = await getPgPool().query(
    `select intervals_connections.id, athlete_profiles.user_id, intervals_connections.external_athlete_id,
            intervals_connections.credential_ref, intervals_connections.sync_status, intervals_connections.created_at,
            athlete_profiles.display_name as connection_label
     from intervals_connections
     join athlete_profiles on athlete_profiles.id = intervals_connections.athlete_profile_id
     where athlete_profiles.user_id = $1
     order by intervals_connections.created_at desc
     limit 1`,
    [userId],
  );
  const row = result.rows[0];
  return row ? mapConnectionRow(row) : null;
}

export async function getDerivedOnboardingStatusRecord(userId: string): Promise<OnboardingRunRecord | null> {
  const state = await getPlatformState();
  const onboarding = deriveOnboardingStatus(state, userId);
  if (!onboarding) return null;
  const syncJob = await getLatestSyncJobForUser(userId, state.syncJobs);
  const connection = syncJob
    ? state.intervalsConnections.find((item) => item.id === syncJob.connectionId && item.userId === userId) || null
    : await getLatestIntervalsConnectionRecord(userId);
  const snapshot = connection ? await getLatestSnapshotForUser(userId, connection.id, state.intervalsSnapshots) : null;
  if (syncJob?.status === 'completed' && snapshot) {
    return {
      ...onboarding,
      state: 'ready',
      progressPct: 100,
      statusMessage: 'Dashboard ready',
    };
  }
  return onboarding;
}

export async function changeUserPasswordRecord(userId: string, currentPassword: string, nextPassword: string): Promise<UserRecord> {
  if (!nextPassword.trim()) throw new Error('New password is required');

  if (!isPostgresSyncStoreEnabled()) {
    const state = await loadPlatformState();
    const user = state.users.find((entry) => entry.id === userId) || null;
    if (!user) throw new Error('User not found');
    if (!verifyPassword(currentPassword, user.password)) throw new Error('Current password is incorrect');
    user.password = hashPassword(nextPassword.trim());
    state.auditEvents.push({ id: makeId('audit'), eventType: 'user.password_changed', entityType: 'user', entityId: user.id, createdAt: nowIso() });
    await savePlatformState(state);
    return user;
  }

  const current = await getUserByIdRecord(userId);
  if (!current) throw new Error('User not found');
  if (!verifyPassword(currentPassword, current.password)) throw new Error('Current password is incorrect');
  const nextHash = hashPassword(nextPassword.trim());
  await getPgPool().query(`update users set password_hash = $2 where id = $1`, [userId, nextHash]);
  await getPgPool().query(
    `insert into audit_events (id, actor_user_id, event_type, entity_type, entity_id, payload_json) values ($1,$2,$3,$4,$5,$6::jsonb)`,
    [randomUUID(), userId, 'user.password_changed', 'user', userId, JSON.stringify({})],
  );
  return { ...current, password: nextHash };
}

export async function applyIntervalsCredentialsRecord(userId: string, input: { athleteId: string; credentialPayload: string; connectionLabel?: string }): Promise<{ onboarding: OnboardingRunRecord; connection: IntervalsConnectionRecord }> {
  if (!input.athleteId.trim()) throw new Error('Intervals athlete ID is required');
  if (!input.credentialPayload.trim()) throw new Error('Intervals credential payload is required');

  if (!isPostgresSyncStoreEnabled()) {
    const state = await loadPlatformState();
    const onboarding = state.onboardingRuns.find((item) => item.userId === userId);
    if (!onboarding) throw new Error('Onboarding run not found');
    const connection: IntervalsConnectionRecord = {
      id: makeId('intervals'),
      userId,
      externalAthleteId: input.athleteId.trim(),
      credentialPayload: input.credentialPayload.trim(),
      connectionLabel: input.connectionLabel?.trim() || undefined,
      syncStatus: 'sync_started',
      createdAt: nowIso(),
    };
    state.intervalsConnections.push(connection);
    const syncJob = {
      id: makeId('syncjob'),
      userId,
      connectionId: connection.id,
      jobType: 'intervals_initial_sync' as const,
      status: 'queued' as const,
      progressPct: 25,
      statusMessage: 'Sync job queued',
      startedAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.syncJobs.push(syncJob);
    onboarding.state = 'sync_started';
    onboarding.progressPct = 25;
    onboarding.statusMessage = 'Sync job queued';
    onboarding.syncStartedAt = nowIso();
    onboarding.updatedAt = nowIso();
    await savePlatformState(state);
    return { onboarding, connection };
  }

  const onboarding = await getOnboardingRunRecord(userId);
  if (!onboarding) throw new Error('Onboarding run not found');
  const workspaceId = (await getUserByIdRecord(userId))?.workspaceId;
  if (!workspaceId) throw new Error('Workspace not found');

  const athleteProfileId = stableUuid(`athlete-profile:${userId}`);
  const connectionCreatedAt = nowIso();
  const syncStartedAt = nowIso();
  const connection: IntervalsConnectionRecord = {
    id: randomUUID(),
    userId,
    externalAthleteId: input.athleteId.trim(),
    credentialPayload: input.credentialPayload.trim(),
    connectionLabel: input.connectionLabel?.trim() || undefined,
    syncStatus: 'sync_started',
    createdAt: connectionCreatedAt,
  };
  await getPgPool().query(
    `insert into athlete_profiles (id, user_id, workspace_id, display_name)
     values ($1,$2,$3,$4)
     on conflict (id) do update set display_name = excluded.display_name, workspace_id = excluded.workspace_id`,
    [athleteProfileId, userId, workspaceId, connection.connectionLabel || 'Athlete'],
  );
  await getPgPool().query(
    `insert into intervals_connections (id, athlete_profile_id, auth_mode, credential_ref, external_athlete_id, sync_status, created_at)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [connection.id, athleteProfileId, 'api_key', connection.credentialPayload, connection.externalAthleteId, connection.syncStatus, connection.createdAt],
  );
  const syncJobId = `syncjob_${randomUUID()}`;
  await getPgPool().query(
    `insert into sync_jobs_runtime (id, user_id, connection_id, job_type, status, progress_pct, status_message, started_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
    [syncJobId, userId, connection.id, 'intervals_initial_sync', 'queued', 25, 'Sync job queued', syncStartedAt],
  );
  await getPgPool().query(
    `update onboarding_runs set state = $2, progress_pct = $3, status_message = $4, details_json = jsonb_set(coalesce(details_json, '{}'::jsonb), '{syncStartedAt}', to_jsonb($5::text)), updated_at = $5 where id = $1`,
    [onboarding.id, 'sync_started', 25, 'Sync job queued', syncStartedAt],
  );
  return {
    onboarding: { ...onboarding, state: 'sync_started', progressPct: 25, statusMessage: 'Sync job queued', syncStartedAt, updatedAt: syncStartedAt },
    connection,
  };
}

export async function upsertIntervalsConnectionRecord(connection: IntervalsConnectionRecord): Promise<void> {
  if (!isPostgresSyncStoreEnabled()) return;
  const workspaceId = (await getUserByIdRecord(connection.userId))?.workspaceId;
  if (!workspaceId) return;
  const athleteProfileId = stableUuid(`athlete-profile:${connection.userId}`);
  await getPgPool().query(
    `insert into athlete_profiles (id, user_id, workspace_id, display_name)
     values ($1,$2,$3,$4)
     on conflict (id) do update set display_name = excluded.display_name, workspace_id = excluded.workspace_id`,
    [athleteProfileId, connection.userId, workspaceId, connection.connectionLabel || 'Athlete'],
  );
  await getPgPool().query(
    `insert into intervals_connections (id, athlete_profile_id, auth_mode, credential_ref, external_athlete_id, sync_status, created_at)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (id) do update set external_athlete_id = excluded.external_athlete_id, credential_ref = excluded.credential_ref, sync_status = excluded.sync_status`,
    [connection.id, athleteProfileId, 'api_key', connection.credentialPayload, connection.externalAthleteId, connection.syncStatus, connection.createdAt],
  );
}

export async function migratePlatformStateToPostgres(sourceState?: PlatformState): Promise<{ migrated: boolean; users: number; invites: number; onboardingRuns: number; intervalsConnections: number; syncJobs: number; intervalsSnapshots: number }> {
  if (!isPostgresSyncStoreEnabled()) {
    throw new Error('DATABASE_URL is not configured');
  }

  const state = sourceState || await loadPlatformState();
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('begin');

    for (const user of state.users) {
      const userId = toDbUuid(user.id, 'user');
      const workspaceId = toDbUuid(user.workspaceId, 'workspace');
      await client.query(
        `insert into users (id, email, password_hash, display_name)
         values ($1,$2,$3,$4)
         on conflict (id) do update set email = excluded.email, password_hash = excluded.password_hash, display_name = excluded.display_name`,
        [userId, normalizeEmail(user.email), user.password, user.displayName],
      );
      await client.query(
        `insert into workspaces (id, name, created_by)
         values ($1,$2,$3)
         on conflict (id) do update set name = excluded.name, created_by = excluded.created_by`,
        [workspaceId, `${user.displayName} workspace`, userId],
      );
    }

    for (const membership of state.memberships) {
      const membershipId = toDbUuid(membership.id, 'membership');
      const workspaceId = toDbUuid(membership.workspaceId, 'workspace');
      const userId = toDbUuid(membership.userId, 'user');
      await client.query(
        `insert into workspace_memberships (id, workspace_id, user_id)
         values ($1,$2,$3)
         on conflict (id) do update set workspace_id = excluded.workspace_id, user_id = excluded.user_id`,
        [membershipId, workspaceId, userId],
      );
      for (const role of membership.roles) {
        await client.query(
          `insert into workspace_membership_roles (id, membership_id, role_key)
           values ($1,$2,$3)
           on conflict (membership_id, role_key) do nothing`,
          [stableUuid(`membership-role:${membership.id}:${role}`), membershipId, role],
        );
      }
    }

    for (const invite of state.invites) {
      const ownerMembership = state.memberships[0];
      if (!ownerMembership) continue;
      await client.query(
        `insert into invite_codes (id, code_hash, created_by_membership_id, max_uses, used_count, status)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (id) do update set code_hash = excluded.code_hash, max_uses = excluded.max_uses, used_count = excluded.used_count, status = excluded.status`,
        [toDbUuid(invite.id, 'invite'), invite.code, toDbUuid(ownerMembership.id, 'membership'), invite.maxUses, invite.usedCount, invite.status],
      );
    }

    for (const onboarding of state.onboardingRuns) {
      await client.query(
        `insert into onboarding_runs (id, user_id, state, progress_pct, status_message, details_json, updated_at)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7)
         on conflict (id) do update set state = excluded.state, progress_pct = excluded.progress_pct, status_message = excluded.status_message, details_json = excluded.details_json, updated_at = excluded.updated_at`,
        [
          toDbUuid(onboarding.id, 'onboarding'),
          toDbUuid(onboarding.userId, 'user'),
          onboarding.state,
          onboarding.progressPct,
          onboarding.statusMessage,
          JSON.stringify(onboarding.syncStartedAt ? { syncStartedAt: onboarding.syncStartedAt } : {}),
          onboarding.updatedAt,
        ],
      );
    }

    for (const connection of state.intervalsConnections) {
      const user = state.users.find((item) => item.id === connection.userId);
      if (!user) continue;
      const athleteProfileId = stableUuid(`athlete-profile:${connection.userId}`);
      await client.query(
        `insert into athlete_profiles (id, user_id, workspace_id, display_name)
         values ($1,$2,$3,$4)
         on conflict (id) do update set workspace_id = excluded.workspace_id, display_name = excluded.display_name`,
        [athleteProfileId, toDbUuid(connection.userId, 'user'), toDbUuid(user.workspaceId, 'workspace'), connection.connectionLabel || user.displayName],
      );
      await client.query(
        `insert into intervals_connections (id, athlete_profile_id, auth_mode, credential_ref, external_athlete_id, sync_status, created_at)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (id) do update set credential_ref = excluded.credential_ref, external_athlete_id = excluded.external_athlete_id, sync_status = excluded.sync_status, created_at = excluded.created_at`,
        [toDbUuid(connection.id, 'intervals-connection'), athleteProfileId, 'api_key', connection.credentialPayload, connection.externalAthleteId, connection.syncStatus, connection.createdAt],
      );
    }

    for (const audit of state.auditEvents) {
      await client.query(
        `insert into audit_events (id, event_type, entity_type, entity_id, payload_json, created_at)
         values ($1,$2,$3,$4,$5::jsonb,$6)
         on conflict (id) do update set event_type = excluded.event_type, entity_type = excluded.entity_type, entity_id = excluded.entity_id, created_at = excluded.created_at`,
        [toDbUuid(audit.id, 'audit'), audit.eventType, audit.entityType, audit.entityId, JSON.stringify({ migrated: true }), audit.createdAt],
      );
    }

    for (const job of state.syncJobs) {
      await client.query(
        `insert into sync_jobs_runtime (id, user_id, connection_id, job_type, status, progress_pct, status_message, started_at, finished_at, last_error, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         on conflict (id) do update set user_id = excluded.user_id, connection_id = excluded.connection_id, job_type = excluded.job_type, status = excluded.status, progress_pct = excluded.progress_pct, status_message = excluded.status_message, started_at = excluded.started_at, finished_at = excluded.finished_at, last_error = excluded.last_error, updated_at = excluded.updated_at`,
        [job.id, toDbUuid(job.userId, 'user'), toDbUuid(job.connectionId, 'intervals-connection'), job.jobType, job.status, job.progressPct, job.statusMessage, job.startedAt || null, job.finishedAt || null, job.lastError || null, job.updatedAt],
      );
    }

    for (const snapshot of state.intervalsSnapshots) {
      await client.query(
        `insert into intervals_snapshots_runtime (id, user_id, connection_id, source_job_id, captured_at, live_state_json)
         values ($1,$2,$3,$4,$5,$6::jsonb)
         on conflict (connection_id) do update set id = excluded.id, user_id = excluded.user_id, source_job_id = excluded.source_job_id, captured_at = excluded.captured_at, live_state_json = excluded.live_state_json`,
        [snapshot.id, toDbUuid(snapshot.userId, 'user'), toDbUuid(snapshot.connectionId, 'intervals-connection'), snapshot.sourceJobId, snapshot.capturedAt, JSON.stringify(snapshot.liveState)],
      );
    }

    await client.query('commit');
    return {
      migrated: true,
      users: state.users.length,
      invites: state.invites.length,
      onboardingRuns: state.onboardingRuns.length,
      intervalsConnections: state.intervalsConnections.length,
      syncJobs: state.syncJobs.length,
      intervalsSnapshots: state.intervalsSnapshots.length,
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
