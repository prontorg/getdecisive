import { randomUUID } from 'node:crypto';

import { getPgPool, isPostgresSyncStoreEnabled } from './pg';
import { loadPlatformState, savePlatformState } from './dev-store';
import { hashPassword, isPasswordHash, verifyPassword } from './auth-password';
import type {
  IntervalsConnectionRecord,
  MembershipRecord,
  OnboardingRunRecord,
  PlatformState,
  RegisterInput,
  UserRecord,
} from './platform-state';

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function getPlatformState(): Promise<PlatformState> {
  return loadPlatformState();
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

    const userId = `user_${randomUUID()}`;
    const workspaceId = `workspace_${randomUUID()}`;
    const membershipId = `membership_${randomUUID()}`;
    const onboardingId = `onboard_${randomUUID()}`;
    const hashed = hashPassword(input.password.trim());

    await client.query(`insert into users (id, email, password_hash, display_name) values ($1,$2,$3,$4)`, [userId, email, hashed, input.displayName.trim()]);
    await client.query(`insert into workspaces (id, name, created_by) values ($1,$2,$3)`, [workspaceId, `${input.displayName.trim()} workspace`, userId]);
    await client.query(`insert into workspace_memberships (id, workspace_id, user_id) values ($1,$2,$3)`, [membershipId, workspaceId, userId]);
    await client.query(`insert into workspace_membership_roles (id, membership_id, role_key) values ($1,$2,$3)`, [`role_${randomUUID()}`, membershipId, 'athlete']);
    await client.query(
      `insert into onboarding_runs (id, user_id, state, progress_pct, status_message, updated_at) values ($1,$2,$3,$4,$5,$6)`,
      [onboardingId, userId, 'account_created', 15, 'Account created. Intervals connection required next.', nowIso()],
    );
    await client.query(`update invite_codes set used_count = used_count + 1 where code_hash = $1`, [input.inviteCode.trim()]);
    await client.query(`insert into audit_events (id, workspace_id, actor_user_id, event_type, entity_type, entity_id, payload_json) values ($1,$2,$3,$4,$5,$6,$7::jsonb)`, [
      `audit_${randomUUID()}`,
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
    `select users.id, users.email, users.password_hash, users.display_name, workspaces.id as workspace_id
     from users
     left join workspace_memberships on workspace_memberships.user_id = users.id
     left join workspaces on workspaces.id = workspace_memberships.workspace_id
     where users.email = $1
     limit 1`,
    [normalized],
  );
  const row = result.rows[0];
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    password: row.password_hash,
    workspaceId: row.workspace_id,
  };
}

export async function getUserByIdRecord(userId: string): Promise<UserRecord | null> {
  if (!isPostgresSyncStoreEnabled()) {
    const state = await loadPlatformState();
    return state.users.find((user) => user.id === userId) || null;
  }
  const result = await getPgPool().query(
    `select users.id, users.email, users.password_hash, users.display_name, workspaces.id as workspace_id
     from users
     left join workspace_memberships on workspace_memberships.user_id = users.id
     left join workspaces on workspaces.id = workspace_memberships.workspace_id
     where users.id = $1
     limit 1`,
    [userId],
  );
  const row = result.rows[0];
  return row ? { id: row.id, email: row.email, displayName: row.display_name, password: row.password_hash, workspaceId: row.workspace_id } : null;
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
  return row ? { id: row.id, userId: row.user_id, state: row.state, progressPct: row.progress_pct, statusMessage: row.status_message, syncStartedAt: row.details_json?.syncStartedAt, updatedAt: row.updated_at?.toISOString?.() || row.updated_at } : null;
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

export async function upsertIntervalsConnectionRecord(connection: IntervalsConnectionRecord): Promise<void> {
  if (!isPostgresSyncStoreEnabled()) return;
  const athleteProfileId = `athlete_profile_${connection.userId}`;
  const workspaceId = (await getUserByIdRecord(connection.userId))?.workspaceId;
  if (!workspaceId) return;
  await getPgPool().query(
    `insert into athlete_profiles (id, user_id, workspace_id, display_name)
     values ($1,$2,$3,$4)
     on conflict (id) do nothing`,
    [athleteProfileId, connection.userId, workspaceId, connection.connectionLabel || 'Athlete'],
  );
  await getPgPool().query(
    `insert into intervals_connections (id, athlete_profile_id, auth_mode, credential_ref, external_athlete_id, sync_status, created_at)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (id) do update set external_athlete_id = excluded.external_athlete_id, sync_status = excluded.sync_status`,
    [connection.id, athleteProfileId, 'api_key', connection.credentialPayload, connection.externalAthleteId, connection.syncStatus, connection.createdAt],
  );
}
