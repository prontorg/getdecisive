import type { OnboardingState, PlatformRole } from '@decisive/types';

export type InviteRecord = {
  id: string;
  code: string;
  status: 'active' | 'revoked';
  maxUses: number;
  usedCount: number;
};

export type UserRecord = {
  id: string;
  email: string;
  displayName: string;
  password: string;
  workspaceId: string;
};

export type MembershipRecord = {
  id: string;
  userId: string;
  workspaceId: string;
  roles: PlatformRole[];
};

export type OnboardingRunRecord = {
  id: string;
  userId: string;
  state: OnboardingState;
  progressPct: number;
  statusMessage: string;
  syncStartedAt?: string;
  updatedAt: string;
};

export type IntervalsConnectionRecord = {
  id: string;
  userId: string;
  externalAthleteId: string;
  credentialPayload: string;
  connectionLabel?: string;
  syncStatus: 'pending' | 'sync_started' | 'ready';
  createdAt: string;
};

export type AuditEventRecord = {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};

export type PlatformState = {
  invites: InviteRecord[];
  users: UserRecord[];
  memberships: MembershipRecord[];
  onboardingRuns: OnboardingRunRecord[];
  intervalsConnections: IntervalsConnectionRecord[];
  auditEvents: AuditEventRecord[];
};

export type RegisterInput = {
  inviteCode: string;
  email: string;
  password: string;
  displayName: string;
};

export type IntervalsInput = {
  athleteId: string;
  credentialPayload: string;
  connectionLabel?: string;
};

const SYNC_STEPS: Array<{ maxElapsedMs: number; state: OnboardingState; progressPct: number; statusMessage: string }> = [
  { maxElapsedMs: 4_000, state: 'sync_started', progressPct: 25, statusMessage: 'Sync job queued' },
  { maxElapsedMs: 8_000, state: 'sync_importing_history', progressPct: 42, statusMessage: 'Importing Intervals history' },
  { maxElapsedMs: 12_000, state: 'sync_processing_activities', progressPct: 68, statusMessage: 'Processing activities and classifying sessions' },
  { maxElapsedMs: 16_000, state: 'sync_building_dashboard', progressPct: 88, statusMessage: 'Building dashboard and coaching read models' },
];

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createSeedPlatformState(): PlatformState {
  return {
    invites: [
      {
        id: 'invite_seed_1',
        code: 'DECISIVE-INVITE',
        status: 'active',
        maxUses: 1,
        usedCount: 0,
      },
    ],
    users: [],
    memberships: [],
    onboardingRuns: [],
    intervalsConnections: [],
    auditEvents: [],
  };
}

export function validateInviteCode(state: PlatformState, code: string): { valid: boolean; reason?: string } {
  const normalized = code.trim();
  const invite = state.invites.find((item) => item.code === normalized);
  if (!invite) return { valid: false, reason: 'Invite code not found' };
  if (invite.status !== 'active') return { valid: false, reason: 'Invite code is not active' };
  if (invite.usedCount >= invite.maxUses) return { valid: false, reason: 'Invite code already used' };
  return { valid: true };
}

export function registerUserWithInvite(state: PlatformState, input: RegisterInput): {
  user: UserRecord;
  membership: MembershipRecord;
  onboarding: OnboardingRunRecord;
} {
  const inviteResult = validateInviteCode(state, input.inviteCode);
  if (!inviteResult.valid) throw new Error(inviteResult.reason || 'Invalid invite code');

  const email = normalizeEmail(input.email);
  if (!email) throw new Error('Email is required');
  if (!input.password.trim()) throw new Error('Password is required');
  if (!input.displayName.trim()) throw new Error('Display name is required');
  if (state.users.some((user) => user.email === email)) throw new Error('Email already exists');

  const workspaceId = makeId('workspace');
  const user: UserRecord = {
    id: makeId('user'),
    email,
    displayName: input.displayName.trim(),
    password: input.password,
    workspaceId,
  };
  const membership: MembershipRecord = {
    id: makeId('membership'),
    userId: user.id,
    workspaceId,
    roles: ['athlete'],
  };
  const onboarding: OnboardingRunRecord = {
    id: makeId('onboard'),
    userId: user.id,
    state: 'account_created',
    progressPct: 15,
    statusMessage: 'Account created. Intervals connection required next.',
    updatedAt: nowIso(),
  };

  state.users.push(user);
  state.memberships.push(membership);
  state.onboardingRuns.push(onboarding);
  const invite = state.invites.find((item) => item.code === input.inviteCode.trim());
  if (invite) invite.usedCount += 1;
  state.auditEvents.push({
    id: makeId('audit'),
    eventType: 'user.registered',
    entityType: 'user',
    entityId: user.id,
    createdAt: nowIso(),
  });

  return { user, membership, onboarding };
}

export function loginWithPassword(state: PlatformState, email: string, password: string): UserRecord | null {
  const normalized = normalizeEmail(email);
  return state.users.find((user) => user.email === normalized && user.password === password) || null;
}

export function getUserById(state: PlatformState, userId: string): UserRecord | null {
  return state.users.find((user) => user.id === userId) || null;
}

export function getMembershipForUser(state: PlatformState, userId: string): MembershipRecord | null {
  return state.memberships.find((membership) => membership.userId === userId) || null;
}

export function isAdminUser(state: PlatformState, userId: string): boolean {
  return Boolean(getMembershipForUser(state, userId)?.roles.includes('admin'));
}

export function changeUserPassword(state: PlatformState, userId: string, currentPassword: string, nextPassword: string): UserRecord {
  const user = getUserById(state, userId);
  if (!user) throw new Error('User not found');
  if (user.password !== currentPassword) throw new Error('Current password is incorrect');
  if (!nextPassword.trim()) throw new Error('New password is required');
  user.password = nextPassword.trim();
  state.auditEvents.push({
    id: makeId('audit'),
    eventType: 'user.password_changed',
    entityType: 'user',
    entityId: user.id,
    createdAt: nowIso(),
  });
  return user;
}

export function getOnboardingRun(state: PlatformState, userId: string): OnboardingRunRecord | null {
  return state.onboardingRuns.find((item) => item.userId === userId) || null;
}

export function applyIntervalsCredentials(state: PlatformState, userId: string, input: IntervalsInput): OnboardingRunRecord {
  if (!input.athleteId.trim()) throw new Error('Intervals athlete ID is required');
  if (!input.credentialPayload.trim()) throw new Error('Intervals credential payload is required');

  const onboarding = getOnboardingRun(state, userId);
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

  onboarding.state = 'sync_started';
  onboarding.progressPct = 25;
  onboarding.statusMessage = 'Sync job queued';
  onboarding.syncStartedAt = nowIso();
  onboarding.updatedAt = nowIso();

  state.auditEvents.push({
    id: makeId('audit'),
    eventType: 'intervals.connected',
    entityType: 'intervals_connection',
    entityId: connection.id,
    createdAt: nowIso(),
  });

  return onboarding;
}

export function deriveOnboardingStatus(state: PlatformState, userId: string, now = new Date()): OnboardingRunRecord | null {
  const onboarding = getOnboardingRun(state, userId);
  if (!onboarding) return null;
  if (!onboarding.syncStartedAt) return onboarding;
  if (onboarding.state === 'ready') return onboarding;

  const elapsed = now.getTime() - new Date(onboarding.syncStartedAt).getTime();
  const step = SYNC_STEPS.find((item) => elapsed < item.maxElapsedMs);
  if (step) {
    onboarding.state = step.state;
    onboarding.progressPct = step.progressPct;
    onboarding.statusMessage = step.statusMessage;
    onboarding.updatedAt = nowIso();
    return onboarding;
  }

  onboarding.state = 'ready';
  onboarding.progressPct = 100;
  onboarding.statusMessage = 'Dashboard ready';
  onboarding.updatedAt = nowIso();

  const connection = state.intervalsConnections.find((item) => item.userId === userId);
  if (connection) connection.syncStatus = 'ready';

  state.auditEvents.push({
    id: makeId('audit'),
    eventType: 'onboarding.ready',
    entityType: 'onboarding_run',
    entityId: onboarding.id,
    createdAt: nowIso(),
  });

  return onboarding;
}
