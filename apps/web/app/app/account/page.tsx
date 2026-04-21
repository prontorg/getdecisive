import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppCard, AppHero, AppPageShell } from '../_components/material-shell';
import { appRoutes } from '../../../lib/routes';
import { getAuthenticatedAppContext } from '../../../lib/server/app-context';
import { getLatestIntervalsConnectionRecord, listManagedUsersRecord } from '../../../lib/server/auth-store';
import { getSessionUserId } from '../../../lib/server/session';
import { getSyncHealthSummary } from '../../../lib/server/sync-health';

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; notice?: string; tab?: string }>;
}) {
  const params = (await searchParams) || {};
  const tab = params.tab || 'profile';
  const userId = await getSessionUserId();
  if (!userId) redirect(appRoutes.login);

  const { user, onboarding, state, isAdmin } = await getAuthenticatedAppContext(userId);
  const intervalsConnection = await getLatestIntervalsConnectionRecord(userId);
  const syncHealth = await getSyncHealthSummary(userId, { connection: intervalsConnection, onboarding });
  const managedUsers = isAdmin ? await listManagedUsersRecord() : [];

  const tabs = [
    { id: 'profile', label: 'Profile' },
    ...(isAdmin ? [
      { id: 'user-management', label: 'User management' },
      { id: 'invites', label: 'Invites' },
    ] : []),
  ];

  return (
    <AppPageShell tone="admin">
      <AppHero
        eyebrow="Configuration"
        title="Configuration"
        description={(
          <>
            <strong>{user.displayName}</strong>
            <br />
            <span className="muted">Status: {syncHealth.healthLabel}</span>
            <br />
            <span className="muted">Athlete ID: {syncHealth.athleteIdLabel}</span>
          </>
        )}
      />

      <section className="nav-grid" style={{ marginBottom: 18 }}>
        {tabs.map((entry) => (
          <Link
            key={entry.id}
            href={`${appRoutes.account}?tab=${entry.id}`}
            className={`app-topbar__nav-link${tab === entry.id ? ' active' : ''}`}
            prefetch={false}
          >
            {entry.label}
          </Link>
        ))}
      </section>

      {params.error ? <p className="notice error">{params.error}</p> : null}
      {params.notice ? <p className="notice">{params.notice}</p> : null}

      {tab === 'profile' ? (
        <section className="panel-grid panel-grid-wide">
          <AppCard>
            <div className="kicker">Profile</div>
            <h2>Athlete profile</h2>
            <p>Keep profile and Intervals connection current.</p>
            <div className="form-grid">
              <label>
                <span>Display name</span>
                <input type="text" value={user.displayName} readOnly />
              </label>
              <label>
                <span>Email</span>
                <input type="email" value={user.email} readOnly />
              </label>
            </div>
            <div className="status-list compact-status-list" style={{ marginTop: 16 }}>
              <div className="status-item"><strong>Sync health</strong><p>{syncHealth.healthLabel}</p></div>
              <div className="status-item"><strong>Worker</strong><p>{syncHealth.jobLabel}</p></div>
              <div className="status-item"><strong>Last snapshot</strong><p>{syncHealth.snapshotLabel}</p></div>
              <div className="status-item"><strong>Athlete ID</strong><p>{syncHealth.athleteIdLabel}</p></div>
              <div className="status-item"><strong>Onboarding</strong><p>{onboarding.state}</p></div>
              <div className="status-item"><strong>Connection state</strong><p>{syncHealth.connectionState}</p></div>
              {syncHealth.failureReason ? <div className="status-item"><strong>Failure reason</strong><p>{syncHealth.failureReason}</p></div> : null}
            </div>
            <div className="button-row" style={{ marginTop: 12 }}>
              <Link href={appRoutes.onboardingSync} className="button-link button-secondary">Open sync status</Link>
            </div>
            <form className="form-grid" action="/api/onboarding/intervals-connect" method="post" style={{ marginTop: 16 }}>
              <input type="hidden" name="redirectTo" value={`${appRoutes.account}?tab=profile`} />
              <label>
                <span>Athlete ID</span>
                <input name="athleteId" type="text" placeholder="17634020" defaultValue={intervalsConnection?.externalAthleteId || ''} required />
              </label>
              <label>
                <span>Credential / API key</span>
                <textarea name="credentialPayload" placeholder="api_key=..." rows={5} required />
              </label>
              <div className="button-row">
                <button type="submit">Save Intervals connection</button>
              </div>
              <p className="muted">Saving credentials here retriggers the user-scoped Intervals sync and updates the sync status page.</p>
            </form>
          </AppCard>

          <AppCard>
            <div className="kicker">Password</div>
            <h2>Update password</h2>
            <p>Keep decisive access private and stable for this athlete login.</p>
            <form className="form-grid" action="/api/auth/change-password" method="post">
              <label>
                <span>Current password</span>
                <input name="currentPassword" type="password" placeholder="Current password" required />
              </label>
              <label>
                <span>New password</span>
                <input name="nextPassword" type="password" placeholder="New password" required />
              </label>
              <label>
                <span>Confirm new password</span>
                <input name="confirmPassword" type="password" placeholder="Repeat new password" required />
              </label>
              <div className="button-row">
                <button type="submit">Update password</button>
              </div>
            </form>
          </AppCard>

          <AppCard>
            <div className="kicker">Current account</div>
            <h2>Account summary</h2>
            <div className="status-list compact-status-list">
              <div className="status-item"><strong>Display name</strong><p>{user.displayName}</p></div>
              <div className="status-item"><strong>Email</strong><p>{user.email}</p></div>
              <div className="status-item"><strong>Status</strong><p>{onboarding.state}</p></div>
              <div className="status-item"><strong>Connected users</strong><p>{state.users.length}</p></div>
            </div>
          </AppCard>
        </section>
      ) : null}

      {tab === 'user-management' && isAdmin ? (
        <section className="panel-grid">
          <AppCard>
            <div className="kicker">User management</div>
            <h2>Add accounts</h2>
            <p>Create athlete or coach accounts, then link Intervals.</p>
            <form className="form-grid" action="/api/admin/users/save" method="post">
              <label>
                <span>Display name</span>
                <input name="displayName" type="text" placeholder="New athlete" required />
              </label>
              <label>
                <span>Email</span>
                <input name="email" type="email" placeholder="athlete@example.com" required />
              </label>
              <label>
                <span>Password</span>
                <input name="password" type="password" placeholder="Temporary password" required />
              </label>
              <label>
                <span>Roles</span>
                <input name="roles" type="text" placeholder="athlete" defaultValue="athlete" />
              </label>
              <div className="button-row">
                <button type="submit">Create user</button>
              </div>
            </form>
          </AppCard>

          <AppCard>
            <div className="kicker">Managed accounts</div>
            <h2>User management</h2>
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Roles</th><th>Intervals</th><th>Status</th></tr></thead>
              <tbody>
              {managedUsers.map((entry) => (
                <tr key={entry.user.id}><td>{entry.user.displayName}</td><td>{entry.user.email}</td><td>{(entry.membership?.roles || []).join(', ') || 'athlete'}</td><td>{entry.intervalsConnection ? `${entry.intervalsConnection.externalAthleteId} • ${entry.intervalsConnection.syncStatus}` : 'not connected'}</td><td>{entry.onboarding?.state || 'account_created'}</td></tr>
              ))}
              </tbody>
            </table>
            <div className="status-list" style={{ marginTop: 16 }}>
              {managedUsers.map((entry) => (
                <div className="status-item" key={entry.user.id}>
                  <strong>{entry.user.displayName}</strong>

                  <form className="form-grid" action="/api/admin/users/save" method="post" style={{ marginTop: 12 }}>
                    <input type="hidden" name="userId" value={entry.user.id} />
                    <label>
                      <span>Display name</span>
                      <input name="displayName" type="text" defaultValue={entry.user.displayName} required />
                    </label>
                    <label>
                      <span>Email</span>
                      <input name="email" type="email" defaultValue={entry.user.email} required />
                    </label>
                    <label>
                      <span>New password</span>
                      <input name="password" type="password" placeholder="Leave blank to keep current" />
                    </label>
                    <label>
                      <span>Roles</span>
                      <input name="roles" type="text" defaultValue={(entry.membership?.roles || ['athlete']).join(',')} />
                    </label>
                    <div className="button-row">
                      <button type="submit">Save user</button>
                    </div>
                  </form>

                  <form className="form-grid" action="/api/admin/users/intervals/save" method="post" style={{ marginTop: 12 }}>
                    <input type="hidden" name="userId" value={entry.user.id} />
                    <input type="hidden" name="connectionLabel" value={entry.user.displayName} />
                    <label>
                      <span>Athlete ID</span>
                      <input name="athleteId" type="text" defaultValue={entry.intervalsConnection?.externalAthleteId || ''} placeholder="17634020" required />
                    </label>
                    <label>
                      <span>Credential / API key</span>
                      <textarea name="credentialPayload" rows={4} placeholder="api_key=..." required />
                    </label>
                    <div className="button-row">
                      <button type="submit">Save Intervals settings</button>
                      {entry.intervalsConnection ? <button type="submit" formAction="/api/admin/users/intervals/delete" className="button-secondary">Remove Intervals</button> : null}
                    </div>
                  </form>

                  <form action="/api/admin/users/delete" method="post" style={{ marginTop: 12 }}>
                    <input type="hidden" name="userId" value={entry.user.id} />
                    <button type="submit" className="button-secondary">Delete user</button>
                  </form>
                </div>
              ))}
            </div>
          </AppCard>
        </section>
      ) : null}

      {tab === 'invites' && isAdmin ? (
        <section className="panel-grid">
          <AppCard>
            <div className="kicker">Access model</div>
            <h2>Invites</h2>
            <p>Admin-only signup control.</p>
            <div className="status-list">
              <div className="status-item"><strong>Invites in store</strong><p>{state.invites.length}</p></div>
              <div className="status-item"><strong>Used invites</strong><p>{state.invites.reduce((sum, invite) => sum + invite.usedCount, 0)}</p></div>
              <div className="status-item"><strong>Registered users</strong><p>{state.users.length}</p></div>
            </div>
            <form className="form-grid" action="/api/invites/create" method="post" style={{ marginTop: 16 }}>
              <label>
                <span>Invite code</span>
                <input name="code" type="text" placeholder="DECISIVE-BETA" />
              </label>
              <label>
                <span>Max uses</span>
                <input name="maxUses" type="number" min="1" defaultValue="1" required />
              </label>
              <div className="button-row">
                <button type="submit">Create invite</button>
              </div>
            </form>
          </AppCard>

          <AppCard>
            <div className="kicker">Invite history</div>
            <h2>Current invites</h2>
            <div className="status-list">
              {state.invites.map((invite) => (
                <div className="status-item" key={invite.id}>
                  <strong>{invite.code}</strong>
                  <p>Status: {invite.status} • Used {invite.usedCount}/{invite.maxUses}</p>
                  {invite.status === 'active' ? (
                    <form action="/api/invites/revoke" method="post">
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <button type="submit" className="button-secondary">Revoke</button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          </AppCard>
        </section>
      ) : null}
    </AppPageShell>
  );
}
