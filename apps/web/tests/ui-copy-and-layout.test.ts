import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const webRoot = process.cwd();
const platformRoot = join(webRoot, '..', '..');
const loginPanelPath = join(webRoot, 'components/auth/LoginPanel.tsx');
const headerPath = join(webRoot, 'app/app/_components/app-header.tsx');
const planPagePath = join(webRoot, 'app/app/_components/training-plan-page.tsx');
const accountPagePath = join(webRoot, 'app/app/account/page.tsx');
const adminPagePath = join(webRoot, 'app/app/admin/page.tsx');
const dashboardPagePath = join(webRoot, 'app/app/dashboard/page.tsx');
const deviceLocationSyncPath = join(webRoot, 'app/app/_components/device-location-sync.tsx');
const middlewarePath = join(webRoot, 'middleware.ts');
const dashboardScriptPath = '/root/.hermes/profiles/profdecisive/scripts/intervals_dashboard.py';

test('login screen copy and auth-page header chrome match the latest product wording', async () => {
  const [loginPanel, header] = await Promise.all([
    readFile(loginPanelPath, 'utf8'),
    readFile(headerPath, 'utf8'),
  ]);

  assert.match(loginPanel, />Get decisive<\/h2>/i);
  assert.match(loginPanel, /<div className="kicker">Login<\/div>/i);
  assert.doesNotMatch(loginPanel, /Simple account login/i);
  assert.doesNotMatch(loginPanel, /Launch auth/i);
  assert.match(header, /const hideNavForAuthScreen = pathname === appRoutes\.login \|\| pathname === appRoutes\.register/i);
  assert.doesNotMatch(header, /Le ciel et la limite/i);
  assert.doesNotMatch(header, /label: 'Configuration'/i);
  assert.match(header, /userDisplayName && userEmail \? `\$\{userDisplayName\} - \$\{userEmail\}`/i);
});

test('training plan page uses the latest decisive monthly-planner framing and layout', async () => {
  const source = await readFile(planPagePath, 'utf8');

  assert.match(source, /title="Plan"/i);
  assert.match(source, /Build next 4 weeks/i);
  assert.match(source, /Confirm Context/i);
  assert.match(source, /Set Month Direction/i);
  assert.match(source, /Review Draft/i);
  assert.match(source, /Calendar Review/i);
  assert.match(source, /Calendar is the main review surface/i);
  assert.match(source, /Publish/i);
  assert.match(source, /Looks right/i);
  assert.match(source, /What should this month do\?/i);
  assert.match(source, /Must follow/i);
  assert.match(source, /Prefer if possible/i);
  assert.match(source, /Generate draft/i);
  assert.match(source, /Your next 4 weeks/i);
  assert.match(source, /Compare to recent 4 weeks/i);
  assert.match(source, /Week controls/i);
  assert.match(source, /Legacy detail view/i);
  assert.match(source, /<details/i);
  assert.match(source, /calendar view/i);
  assert.match(source, /Month view/i);
  assert.match(source, /Action/i);
  assert.match(source, /select name="action"/i);
  assert.match(source, /Move day/i);
  assert.match(source, /moveDate/i);
  assert.match(source, /Use suggested day/i);
  assert.match(source, /moveConflictReason/i);
  assert.match(source, /moveConflictSuggestedDate/i);
  assert.match(source, /recentWindow/i);
  assert.match(source, /draftWindow/i);
  assert.match(source, /categoryComparison/i);
  assert.match(source, /freshnessWarnings/i);
  assert.match(source, /comparePayload\.summary/i);
  assert.match(source, /Publish plan/i);
  assert.match(source, /getLatestMonthlyPlanDraft/i);
  assert.match(source, /getLatestMonthlyPlanInput/i);
  assert.doesNotMatch(source, /title="Your Goals & Plan"/i);
  assert.doesNotMatch(source, /Goal direction summary/i);
});

test('dashboard pages keep the shared page hero shell and current dashboard embed structure', async () => {
  const [pageSource, dashboardSource, deviceLocationSyncSource, coachDashboardSource] = await Promise.all([
    readFile(dashboardPagePath, 'utf8'),
    readFile(dashboardScriptPath, 'utf8'),
    readFile(deviceLocationSyncPath, 'utf8'),
    readFile(join(webRoot, 'lib/server/coach-dashboard.ts'), 'utf8'),
  ]);

  assert.match(pageSource, /AppHero/i);
  assert.match(pageSource, /title="Training Dashboard"/i);
  assert.match(pageSource, /dashboard-fragment-host/i);
  assert.doesNotMatch(pageSource, /LocationRefreshButton/i);
  assert.match(deviceLocationSyncSource, /const staleLocation = !city \|\| city === 'current location' \|\| !hasCoords/i);
  assert.match(deviceLocationSyncSource, /maximumAge: staleLocation \? 0 : 30 \* 60 \* 1000/i);
  assert.match(deviceLocationSyncSource, /router\.refresh\(\)/i);
  assert.match(deviceLocationSyncSource, /pathname\?\.startsWith\('\/app'\)/i);
  assert.match(coachDashboardSource, /const city = cookieCity \|\|/i);
  assert.match(coachDashboardSource, /const country = cookieCity \? cookieCountry/i);
  assert.match(dashboardSource, /<div class="kicker">Overview<\/div>/i);
  assert.doesNotMatch(dashboardSource, /<div class="kicker">Training Dashboard<\/div>/i);
  assert.match(dashboardSource, /overview-grid/i);
  assert.doesNotMatch(dashboardSource, /overview-metrics/i);
  assert.doesNotMatch(dashboardSource, /overview-support/i);
  assert.match(dashboardSource, /volume-grid/i);
  assert.match(pageSource, /title="Training Dashboard"/i);
  assert.match(dashboardSource, /md-page-hero/i);
  assert.match(dashboardSource, /This week plan/i);
  assert.match(dashboardSource, /<h2>Last activity<\/h2>/i);
  assert.match(dashboardSource, /Last activity - /i);
  assert.match(dashboardSource, /Past take/i);
  assert.match(dashboardSource, /weather.*current location|current location.*weather|weather-place/i);
  assert.match(dashboardSource, /Daily user input/i);
  assert.match(dashboardSource, /type="range"/i);
  assert.match(dashboardSource, /disabled/i);
  assert.match(dashboardSource, /<h2>Training plan<\/h2>/i);
  assert.match(dashboardSource, /latest-grid/i);
  assert.match(dashboardSource, /chart-top-row/i);
  assert.match(dashboardSource, /<h3>Fitness trend<\/h3>/i);
  assert.match(dashboardSource, /<h3>Current month<\/h3>/i);
  assert.match(dashboardSource, /<h3>This Week<\/h3>/i);
  assert.match(dashboardSource, /<h3>This Month<\/h3>/i);
  assert.match(dashboardSource, /Rest day/i);
  assert.match(dashboardSource, /timeline_rows/i);
  assert.match(dashboardSource, /activity-label/i);
  assert.match(dashboardSource, /chart-month-separator/i);
  assert.match(dashboardSource, /well\[-365:\] if well else \[\]/i);
  assert.match(dashboardSource, /wind_speed_10m_max/i);
  assert.match(dashboardSource, /resp\.raw\.headers\.get_all\('Set-Cookie'\)/i);
  assert.match(dashboardSource, /reverse_geocode_label\(latitude, longitude\)/i);
  assert.match(dashboardSource, /z5 >= 10 \* 60 or z6 >= 6 \* 60/i);
  assert.match(dashboardSource, /category_color\(session_category_from_row\(row\)\)/i);
});

test('middleware protects app pages and sends logged-out users to login by default', async () => {
  const source = await readFile(middlewarePath, 'utf8');

  assert.match(source, /pathname\.startsWith\('\/app'\)/i);
  assert.match(source, /redirectTo\(appRoutes\.login, request\)/i);
  assert.match(source, /pathname === appRoutes\.landing/i);
  assert.match(source, /matcher:/i);
});

test('configuration pages expose athlete configuration and admin-only user management subtab structure', async () => {
  const [header, account, admin] = await Promise.all([
    readFile(headerPath, 'utf8'),
    readFile(accountPagePath, 'utf8'),
    readFile(adminPagePath, 'utf8'),
  ]);

  assert.doesNotMatch(header, /label: 'Configuration'/i);
  assert.doesNotMatch(header, /label: 'Your Goals & Plan'/i);
  assert.match(header, /label: 'Insight'/i);
  assert.match(header, /label: 'Plan'/i);
  assert.match(header, /GET DECISIVE/i);
  assert.match(header, /userDisplayName/i);
  assert.match(header, /userEmail/i);
  assert.match(header, /Config\n/i);
  assert.doesNotMatch(header, /Le ciel et la limite/i);
  assert.match(account, /title="Configuration"/i);
  assert.doesNotMatch(account, /tab === 'intervals'/i);
  assert.match(account, /Intervals connection/i);
  assert.match(account, /Display name/i);
  assert.match(account, /Update password/i);
  assert.match(account, /Invite-only signup/i);
  assert.match(account, /User management/i);
  assert.match(account, /table/i);
  assert.doesNotMatch(account, /<span className="chip">Email:/i);
  assert.doesNotMatch(account, /Onboarding:/i);
  assert.doesNotMatch(account, /Connection label/i);
  assert.match(account, /Athlete ID/i);
  assert.match(admin, /redirect\(\`\$\{appRoutes\.account\}\?tab=user-management\`\)/i);
});
