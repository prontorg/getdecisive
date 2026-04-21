import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const webRoot = process.cwd();
const platformRoot = join(webRoot, '..', '..');
const loginPanelPath = join(webRoot, 'components/auth/LoginPanel.tsx');
const headerPath = join(webRoot, 'app/app/_components/app-header.tsx');
const planPagePath = join(webRoot, 'app/app/plan/page.tsx');
const trainingPlanPagePath = join(webRoot, 'app/app/_components/training-plan-page.tsx');
const trainingPlanCalendarPath = join(webRoot, 'app/app/_components/training-plan-calendar.tsx');
const calendarStylesPath = join(webRoot, 'app/globals.css');
const calendarPagePath = join(webRoot, 'app/app/calendar/page.tsx');
const accountPagePath = join(webRoot, 'app/app/account/page.tsx');
const adminPagePath = join(webRoot, 'app/app/admin/page.tsx');
const syncStatusPagePath = join(webRoot, 'app/onboarding/sync-status/page.tsx');
const dashboardPagePath = join(webRoot, 'app/app/dashboard/page.tsx');
const appLiveRefreshPath = join(webRoot, 'app/app/_components/app-live-refresh.tsx');
const deviceLocationSyncPath = join(webRoot, 'app/app/_components/device-location-sync.tsx');
const middlewarePath = join(webRoot, 'middleware.ts');
const intervalsConnectPanelPath = join(webRoot, 'components/auth/IntervalsConnectPanel.tsx');
const workoutsPagePath = join(webRoot, 'app/app/workouts/page.tsx');
const dashboardScriptPath = '/root/.hermes/profiles/profdecisive/scripts/intervals_dashboard.py';

test('login screen copy and auth-page header chrome match the latest product wording', async () => {
  const [loginPanel, header, registerPage, registerPanel, loginPageSource] = await Promise.all([
    readFile(loginPanelPath, 'utf8'),
    readFile(headerPath, 'utf8'),
    readFile(join(webRoot, 'app/register/page.tsx'), 'utf8'),
    readFile(join(webRoot, 'components/auth/RegisterPanel.tsx'), 'utf8'),
    readFile(join(webRoot, 'app/login/page.tsx'), 'utf8'),
  ]);

  assert.match(loginPanel, /auth-login-card-m3/i);
  assert.match(loginPanel, /auth-login-card__header/i);
  assert.match(loginPanel, /auth-login-form/i);
  assert.match(loginPanel, /auth-login-submit/i);
  assert.match(loginPageSource, /auth-screen-shell-m3/i);
  assert.match(loginPageSource, /auth-screen-panel-m3/i);
  assert.match(loginPageSource, /auth-invite-row-m3/i);
  assert.doesNotMatch(loginPanel, /Simple account login/i);
  assert.doesNotMatch(loginPanel, /Launch auth/i);
  assert.match(header, /const hideNavForAuthScreen = pathname === appRoutes\.login \|\| pathname === appRoutes\.register/i);
  assert.doesNotMatch(header, /Le ciel et la limite/i);
  assert.doesNotMatch(header, /label: 'Configuration'/i);
  assert.match(header, /userDisplayName && userEmail \? `\$\{userDisplayName\} - \$\{userEmail\}`/i);
  assert.match(registerPage, /validateInviteCodeRecord/i);
  assert.match(registerPanel, /disabled=\{!hasInviteCode\}/i);
  assert.match(registerPanel, /Open signup from a valid invite link before creating an account/i);
});

test('training plan page uses the latest decisive monthly-planner framing and layout', async () => {
  const [planPageSource, source, calendarSource, calendarStyles, calendarPageSource, statefulBuilderSource] = await Promise.all([
    readFile(planPagePath, 'utf8'),
    readFile(trainingPlanPagePath, 'utf8'),
    readFile(trainingPlanCalendarPath, 'utf8'),
    readFile(calendarStylesPath, 'utf8'),
    readFile(calendarPagePath, 'utf8'),
    readFile(join(webRoot, 'app/app/_components/training-plan-stateful-builder-client.tsx'), 'utf8'),
  ]);

  assert.match(planPageSource, /mode=\"plan\"/i);
  assert.match(calendarPageSource, /mode=\"calendar\"/i);
  assert.match(source, /heroTitle = isCalendarMode \? 'Calendar' : 'Plan'/i);
  assert.match(source, /Live week first\. Future weeks stay editable\./i);
  assert.match(source, /heroTitle = isCalendarMode \? 'Calendar' : 'Plan'/i);
  assert.match(source, /training-plan-stateful-builder-client/i);
  assert.match(source, /<TrainingPlanStatefulBuilderClient/i);
  assert.match(source, /Quick builder/i);
  assert.match(source, /getActivePlanningContext/i);
  assert.match(source, /Live now/i);
  assert.match(source, /Tomorrow/i);
  assert.match(source, /Freshness/i);
  assert.match(source, /Key slot/i);
  assert.match(source, /formatLiveSyncStamp/i);
  assert.match(source, /Last updated .* UTC|Snapshot refresh pending/i);
  assert.match(source, /training-plan-range-headline/i);
  assert.match(source, /formatRange/i);
  assert.match(source, /training-plan-live-strip/i);
  assert.match(source, /training-plan-stateful-builder-client/i);
  assert.match(statefulBuilderSource, /Month direction/i);
  assert.match(source, /Live week first\. Future weeks stay editable\./i);
  assert.match(source, /Live week on top, editable month underneath\./i);
  assert.match(statefulBuilderSource, /Generate plan/i);
  assert.match(await readFile(join(webRoot, 'app/api/planner/month/draft/route.ts'), 'utf8'), /appRoutes\.plan\?notice=.*Draft generated|revalidatePath\(appRoutes\.calendar\)/i);
  assert.doesNotMatch(source, /Open full calendar/i);
  assert.match(source, /Review the live week and the generated month/i);
  assert.match(source, /training-plan-live-strip__item/i);
  assert.match(source, /training-plan-calendar-toolbar|training-plan-inline-panel|Publish future draft/i);
  assert.match(source, /Publish future draft/i);
  assert.match(source, /Live week stays runtime-backed/i);
  assert.doesNotMatch(source, /training-plan-publish-inline/i);
  assert.match(calendarSource, /effectAllowed = 'move'/i);
  assert.match(calendarSource, /setData\('text\/plain', workout\.id\)/i);
  assert.match(calendarSource, /getData\('text\/plain'\)/i);
  assert.match(calendarSource, /draggable=\{!workout\.locked\}/i);
  assert.match(source, /Publish plan/i);
  assert.match(calendarSource, /past/i);
  assert.match(calendarSource, /plannedForDisplay/i);
  assert.match(calendarSource, /training-plan-day-card__summary/i);
  assert.match(calendarSource, /intervalLabel/i);
  assert.match(calendarSource, /training-plan-session-card__subhead/i);
  assert.match(calendarSource, /training-plan-day-card-empty/i);
  assert.match(source, /recentWindow/i);
  assert.doesNotMatch(source, /training-plan-review-meta/i);
  assert.match(source, /Live week on top, editable month underneath\./i);
  const plannerDataSource = await readFile(join(webRoot, 'lib/server/planner-data.ts'), 'utf8');
  assert.match(source, /displayedWeeks/i);
  assert.match(source, /replaceCurrentWeekWithRuntime/i);
  assert.match(plannerDataSource, /activePlanningIntentFromCycle/i);
  assert.match(plannerDataSource, /runtimeWorkoutCategory/i);
  assert.match(plannerDataSource, /weekSpanFromDraftWeek/i);
  assert.match(plannerDataSource, /weekWindowForToday/i);
  assert.match(plannerDataSource, /day\.date >= today/i);
  assert.match(plannerDataSource, /visibleWeekWorkouts/i);
  assert.match(calendarSource, /completedThisWeek/i);
  assert.match(calendarSource, /rest-day-subtle/i);
  assert.match(calendarSource, /training-plan-week-summary-column/i);
  assert.match(calendarSource, /training-plan-week-summary-card/i);
  assert.match(calendarSource, /calendarRows/i);
  assert.match(calendarSource, /rowIndexByWeekIndex/i);
  assert.match(calendarStyles, /--calendar-row-height:\s*clamp\(138px, 16vw, 176px\)/i);
  assert.match(calendarStyles, /\.training-plan-month-grid \{[^}]*grid-auto-rows:\s*var\(--calendar-row-height\)/i);
  assert.match(calendarStyles, /\.training-plan-week-summary-card \{[^}]*height:\s*var\(--calendar-row-height\)/i);
  assert.match(calendarStyles, /\.training-plan-week-summary-column \{[^}]*grid-auto-rows:\s*var\(--calendar-row-height\)/i);
  assert.match(calendarStyles, /\.rest-day-subtle \{[^}]*background:\s*linear-gradient\(180deg, rgba\(12,15,21,0\.74\), rgba\(10,13,19,0\.62\)\)/i);
  assert.match(calendarStyles, /\.rest-day-subtle \{[^}]*border-color:\s*rgba\(120,134,156,0\.06\)/i);
  assert.match(calendarStyles, /\.rest-day-subtle \.training-plan-day-card__header strong \{[^}]*color:\s*#d7e2f0/i);
  assert.match(calendarStyles, /\.rest-day-subtle \.training-plan-day-card__summary \{[^}]*color:\s*#9aa9bb/i);
  assert.match(calendarStyles, /\.session-tone-rest \{[^}]*--session-border:\s*rgba\(120,134,156,0\.18\)[^}]*--session-bg:\s*rgba\(120,134,156,0\.06\)/i);
  assert.match(calendarStyles, /\.session-tone-rest \.training-plan-session-card__label \{[^}]*color:\s*#d7e2f0/i);
  assert.match(calendarStyles, /\.session-tone-rest \.training-plan-session-card__subhead \{[^}]*color:\s*#9aa9bb/i);
  assert.match(calendarStyles, /\.session-tone-rest \.training-plan-session-card__tag \{[^}]*background:\s*rgba\(255,255,255,0\.04\)[^}]*color:\s*#cbd5e1/i);
  assert.match(source, /Action/i);
  assert.match(calendarSource, /summary title=\"Session actions\"/i);
  assert.match(calendarSource, /training-plan-day-card__header/i);
  assert.match(calendarSource, /shortDateLabel/i);
  assert.match(calendarSource, /sessionToneClass/i);
  assert.match(calendarSource, /training-plan-month-grid/i);
  assert.match(calendarSource, /training-plan-inline-menu/i);
  assert.match(calendarSource, /training-plan-session-card__quick-actions/i);
  assert.match(calendarSource, /mutateWorkout\(workout\.id, 'easier'\)/i);
  assert.match(calendarSource, /mutateWorkout\(workout\.id, 'harder'\)/i);
  assert.match(calendarSource, /mutateWorkout\(workout\.id, 'lock'/i);
  assert.match(calendarSource, /Remove now/i);
  assert.match(calendarSource, /dayHint\(draggingWorkoutId, date\)/i);
  assert.match(calendarSource, /Same-day conflict/i);
  assert.match(calendarSource, /Back-to-back hard risk/i);
  assert.match(calendarSource, /Drop looks usable/i);
  assert.match(calendarSource, /training-plan-day-card__drop-hint/i);
  assert.match(calendarStyles, /training-plan-session-card__quick-actions/i);
  assert.match(calendarStyles, /opacity:\s*\.42/i);
  assert.match(calendarStyles, /training-plan-session-card:hover \.training-plan-session-card__quick-actions/i);
  assert.match(calendarStyles, /training-plan-day-card-drop-warning/i);
  assert.match(calendarStyles, /training-plan-day-card-drop-blocked/i);
  assert.match(calendarSource, /Move day/i);
  assert.match(calendarSource, /moveDate/i);
  assert.match(source, /Week controls/i);
  assert.match(source, /currentWeekBridge\?\.draftBridgeLabel/i);
  assert.match(source, /Week controls/i);
  assert.match(source, /Draft built from/i);
  assert.match(source, /Confidence/i);

  assert.match(source, /training-plan-mini-facts/i);
  assert.match(source, /training-plan-mini-fact/i);
  assert.match(source, /<strong>Today<\/strong>/i);
  assert.match(source, /<strong>Done<\/strong>/i);
  assert.match(source, /<strong>Tomorrow<\/strong>/i);
  assert.match(source, /<strong>Confidence<\/strong>/i);
  assert.match(source, /<strong>Hours left<\/strong>/i);
  assert.match(source, /<strong>Key slots<\/strong>/i);
  assert.match(source, /More week actions/i);
  assert.match(source, /<button type="submit">Repair<\/button>/i);
  assert.match(source, /<button type="submit">Cut load<\/button>/i);
  assert.match(source, /<button type="submit">Use freshness<\/button>/i);
  assert.match(source, /<button type="submit">Reduce<\/button>/i);
  assert.match(source, /<button type="submit">Race-like<\/button>/i);
  assert.match(source, /Quick builder/i);
  assert.match(source, /Choose, tune, review/i);
  assert.match(source, /Pick a direction, then build\./i);
  assert.match(source, /Live now/i);
  assert.match(statefulBuilderSource, /Month direction/i);
  assert.match(source, /training-plan-quick-builder/i);
  assert.match(statefulBuilderSource, /training-plan-focus-chip/i);
  assert.match(statefulBuilderSource, /Recommended<\/span>/i);
  assert.match(statefulBuilderSource, /selectedRecommendationReason/i);
  assert.match(statefulBuilderSource, /selectedRecommendationTitle/i);
  assert.match(statefulBuilderSource, /selectedRecommendationSource/i);
  assert.match(statefulBuilderSource, /selectedRecommendationConfidence/i);
  assert.match(statefulBuilderSource, /<form action=\"\/api\/planner\/month\/draft\" method=\"post\" className=\"training-plan-stateful-builder-client\">/i);
  assert.match(statefulBuilderSource, /type=\"hidden\" name=\"objective\" value=\{submitPayload\.objective\}/i);
  assert.match(statefulBuilderSource, /name=\"objectiveVisible\" value=\{selectedFocusObjective\}/i);
  assert.match(statefulBuilderSource, /name=\"maxWeeklyHours\"[^\n]*value=\{maxWeeklyHours\}/i);
  assert.match(statefulBuilderSource, /name=\"restDay\" value=\{restDay\}/i);
  assert.match(statefulBuilderSource, /name=\"restDaysPerWeek\" value=\{restDaysPerWeek\}/i);
  assert.match(statefulBuilderSource, /name=\"longRideDay\" value=\{longRideDay\}/i);
  assert.match(statefulBuilderSource, /name=\"note\"[^\n]*value=\{note\}/i);
  assert.match(statefulBuilderSource, /name=\"successMarkers\" value=\{item\} checked=\{selectedSuccessMarkers\.includes\(item\)\}/i);
  assert.match(statefulBuilderSource, /type=\"button\"/i);
  assert.match(statefulBuilderSource, /aria-pressed=\{primaryChipPressed\}/i);
  assert.match(statefulBuilderSource, /aria-pressed=\{altChipPressed\(item\.objective\)\}/i);
  assert.match(statefulBuilderSource, /training-plan-focus-chip-selected/i);
  assert.match(statefulBuilderSource, /const primaryChipPressed = selectedFocusObjective === recommendationPrimary\.objective \? 'true' : 'false'/i);
  assert.match(statefulBuilderSource, /return selectedRecommendationSource === 'alternative' && selectedFocusObjective === objective \? 'true' : 'false'/i);
  assert.doesNotMatch(statefulBuilderSource, /className=\"training-plan-focus-chip-form\"/i);
  assert.match(statefulBuilderSource, /More options/i);
  assert.match(statefulBuilderSource, /Month focus/i);
  assert.match(statefulBuilderSource, /name=\"restDay\"/i);
  assert.match(statefulBuilderSource, /name=\"restDaysPerWeek\"/i);
  assert.match(statefulBuilderSource, /Rest days \/ week/i);
  assert.match(statefulBuilderSource, /name=\"longRideDay\"/i);
  assert.match(statefulBuilderSource, /useState\(/i);
  assert.match(statefulBuilderSource, /selectedFocusObjective/i);
  assert.match(statefulBuilderSource, /setSelectedFocusObjective/i);
  assert.match(statefulBuilderSource, /buildBuilderSubmitPayload\(builderState\)/i);
  assert.match(statefulBuilderSource, /selectAlternativeRecommendation\(builderState/i);
  assert.match(statefulBuilderSource, /selectPrimaryRecommendation\(builderState/i);
  assert.match(statefulBuilderSource, /applyManualObjectiveOverride/i);
  assert.match(statefulBuilderSource, /buildBuilderSubmitPayload/i);
  assert.match(statefulBuilderSource, /selectAlternativeRecommendation/i);
  assert.match(statefulBuilderSource, /selectPrimaryRecommendation/i);
  assert.match(statefulBuilderSource, /Generate plan/i);
  assert.match(source, /Review the live week and the generated month/i);
  assert.match(statefulBuilderSource, /Compact builder/i);
  assert.match(source, /Pick a direction, then build\./i);
  assert.match(statefulBuilderSource, /recommendationAlternatives\.map/i);
  assert.match(statefulBuilderSource, /training-plan-focus-chip/i);
  assert.match(statefulBuilderSource, /\{item\.title\}/i);
  assert.doesNotMatch(source, /Understand, decide, build, then review/i);
  assert.doesNotMatch(source, /Use this first/i);
  assert.doesNotMatch(source, /Live, not guessed/i);
  assert.doesNotMatch(source, /If it looks wrong/i);
  assert.doesNotMatch(source, /Accept recommendation/i);
  assert.doesNotMatch(source, /Use recommendation<\/button>/i);
  assert.doesNotMatch(source, /Why this recommendation/i);
  assert.doesNotMatch(source, /Risks to watch/i);
  assert.doesNotMatch(source, /recommendedConstraints/i);
  assert.doesNotMatch(source, /1\. Check the live week/i);
  assert.doesNotMatch(source, /2\. Adjust the draft bridge/i);
  assert.doesNotMatch(source, /3\. Tidy the month/i);
  assert.match(source, /Week controls/i);
  assert.match(source, /More week actions/i);
  assert.match(source, /training-plan-inline-panel-week-actions/i);
  assert.match(source, /More month actions/i);
  assert.match(calendarStyles, /--m3-radius-md/i);
  assert.match(calendarStyles, /border-radius:\s*999px/i);
  assert.match(calendarStyles, /training-plan-mini-facts/i);
  assert.match(calendarStyles, /training-plan-quick-builder/i);
  assert.match(calendarStyles, /training-plan-quick-builder__header/i);
  assert.match(calendarStyles, /training-plan-focus-row/i);
  assert.match(calendarStyles, /training-plan-focus-chip/i);
  assert.match(calendarStyles, /training-plan-focus-chip-selected/i);
  assert.match(calendarStyles, /\.training-plan-focus-chip\[aria-pressed='true'\]/i);
  assert.match(calendarStyles, /training-plan-builder-bar/i);
  assert.match(calendarStyles, /training-plan-builder-advanced/i);
  assert.match(calendarStyles, /training-plan-live-strip/i);
  assert.match(calendarStyles, /training-plan-calendar-toolbar \{/i);
  assert.match(calendarStyles, /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\) auto/i);
  assert.match(calendarStyles, /status-item \{[^}]*border:\s*1px solid rgba\(122,167,255,0\.1\)/i);
  assert.match(calendarStyles, /training-plan-action-pills button/i);
  assert.match(calendarStyles, /training-plan-inline-menu summary,[\s\S]*width:\s*28px/i);
  assert.match(source, /Next key day/i);
  assert.match(source, /Risk:/i);
  assert.match(source, /\/api\/planner\/month\/replan/i);
  assert.match(calendarSource, /moveFeedback/i);
  assert.match(calendarSource, /successNotice/i);
  assert.match(calendarSource, /Calendar move blocked/i);
  assert.match(calendarSource, /Calendar move applied/i);
  assert.match(calendarSource, /Requested day:/i);
  assert.match(calendarSource, /Use suggested day/i);
  assert.match(calendarSource, /payload\?\.code === 'move_conflict'/i);
  assert.match(source, /Use suggested day/i);
  assert.match(source, /moveConflictReason/i);
  assert.match(source, /moveConflictSuggestedDate/i);
  assert.match(source, /recentWindow/i);
  assert.match(source, /draftWindow/i);
  assert.match(source, /categoryComparison/i);
  assert.match(source, /comparePayload\.summary/i);
  assert.match(source, /Publish plan/i);
  assert.match(source, /getLatestMonthlyPlanDraft/i);
  assert.match(source, /getLatestMonthlyPlanInput/i);
  assert.match(source, /needsAutomaticDraftRefresh/i);
  assert.match(source, /latestDraft\.monthStart !== currentMonthStart/i);
  assert.match(source, /latestDraft\.updatedAt \|\| ''\)\.slice\(0, 10\) < today/i);
  assert.match(source, /saveMonthlyPlanDraft/i);
  assert.match(source, /buildMonthlyPlannerDraftPayload/i);
  assert.match(source, /currentDirection/i);
  assert.match(await readFile(join(webRoot, 'lib/server/planner-data.ts'), 'utf8'), /goals, current figures, and recent history|current figures, and recent history/i);
  assert.doesNotMatch(source, /title="Your Goals & Plan"/i);
  assert.doesNotMatch(source, /Goal direction summary/i);
});

test('dashboard pages keep the shared page hero shell and current dashboard embed structure', async () => {
  const [pageSource, dashboardSource, liveRefreshSource, deviceLocationSyncSource, coachDashboardSource, layoutSource] = await Promise.all([
    readFile(dashboardPagePath, 'utf8'),
    readFile(dashboardScriptPath, 'utf8'),
    readFile(appLiveRefreshPath, 'utf8'),
    readFile(deviceLocationSyncPath, 'utf8'),
    readFile(join(webRoot, 'lib/server/coach-dashboard.ts'), 'utf8'),
    readFile(join(webRoot, 'app/layout.tsx'), 'utf8'),
  ]);

  assert.match(pageSource, /AppHero/i);
  assert.match(pageSource, /title="Training Dashboard"/i);
  assert.match(pageSource, /dashboard-fragment-host/i);
  assert.doesNotMatch(pageSource, /LocationRefreshButton/i);
  assert.match(layoutSource, /<AppLiveRefresh \/>/i);
  assert.match(liveRefreshSource, /REFRESH_INTERVAL_MS = 5 \* 60 \* 1000/i);
  assert.match(liveRefreshSource, /APP_REFRESH_PATHS = new Set\(\['\/app\/dashboard', '\/app\/plan', '\/app\/calendar'\]\)/i);
  assert.match(liveRefreshSource, /window\.setInterval\(refreshIfStale, REFRESH_INTERVAL_MS\)/i);
  assert.match(liveRefreshSource, /window\.addEventListener\('focus', refreshIfStale\)/i);
  assert.match(liveRefreshSource, /document\.addEventListener\('visibilitychange', handleVisibility\)/i);
  assert.match(liveRefreshSource, /const dayChanged = activeDayRef\.current !== currentDay/i);
  assert.match(liveRefreshSource, /router\.refresh\(\)/i);
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
  assert.match(pageSource, /getActivePlanningContext/i);
  assert.match(pageSource, /Planning/i);
  assert.match(pageSource, /Week intention/i);
  assert.match(pageSource, /Planned today/i);
  assert.match(pageSource, /Actually today/i);
  assert.match(pageSource, /Planned tomorrow/i);
  assert.match(pageSource, /Tomorrow likely becomes/i);
  assert.match(pageSource, /Why this is the call/i);
  assert.match(pageSource, /formatLiveSyncStamp/i);
  assert.match(pageSource, /Last updated .* UTC|Snapshot refresh pending/i);
  assert.match(dashboardSource, /<div class="overview-copy">\{esc\(live_sync_stamp\)\}<\/div>/i);
  assert.match(dashboardSource, /def format_last_updated\(value: Any\) -> str:/i);
  assert.match(dashboardSource, /merged_live_state\['last_updated_at'\] = latest\.get\('capturedAt'\)/i);
  assert.match(dashboardSource, /md-page-hero/i);
  assert.match(dashboardSource, /Today view/i);
  assert.match(dashboardSource, /Tomorrow view/i);
  assert.doesNotMatch(dashboardSource, /This week plan/i);
  assert.match(dashboardSource, /<h2>Last activity<\/h2>/i);
  assert.match(dashboardSource, /Last activity - /i);
  assert.match(dashboardSource, /Ride analysis/i);
  assert.doesNotMatch(dashboardSource, /Past take/i);
  assert.match(dashboardSource, /weather.*current location|current location.*weather|weather-place/i);
  assert.match(dashboardSource, /DEFAULT_WEATHER_LABEL = f'\{DEFAULT_WEATHER_CITY\}, \{DEFAULT_WEATHER_COUNTRY\}'/i);
  assert.match(dashboardSource, /if key == 'next_three' and isinstance\(value, list\):/i);
  assert.match(dashboardSource, /if not merged_item\.get\('weather'\):/i);
  assert.match(dashboardSource, /merged_item\['weather'\] = base_item\.get\('weather'\)/i);
  assert.match(dashboardSource, /city = DEFAULT_WEATHER_CITY/i);
  assert.match(dashboardSource, /state\['today_weather'\] = weather_by_date\.get\(state\.get\('today'\)\) or state\.get\('today_weather'\)/i);
  assert.match(dashboardSource, /derive_week_rows_from_recent_rows/i);
  assert.match(dashboardSource, /missed-row/i);
  assert.match(dashboardSource, /planned \/ not done/i);
  assert.match(dashboardSource, /Daily user input/i);
  assert.match(dashboardSource, /type="range"/i);
  assert.match(dashboardSource, /disabled/i);
  assert.match(dashboardSource, /<h2>Training plan<\/h2>/i);
  assert.match(dashboardSource, /latest-grid/i);
  assert.match(dashboardSource, /chart-top-row/i);
  assert.match(dashboardSource, /<h3>Fitness trend<\/h3>/i);
  assert.match(dashboardSource, /<h3>Current month<\/h3>/i);
  assert.match(dashboardSource, /summary-chip-row/i);
  assert.match(dashboardSource, /render_cumulative_summary\(state.get\('month_summary'\) or \{\}, 'This month'\)/i);
  assert.match(dashboardSource, /render_cumulative_summary\(state.get\('year_summary'\) or \{\}, 'This year'\)/i);
  assert.match(dashboardSource, /sessions incl\. virtual/i);
  assert.match(dashboardSource, /virtual placeholders/i);
  assert.match(dashboardSource, /month_summary/i);
  assert.match(dashboardSource, /year_summary/i);
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
  const [header, account, admin, intervalsConnectPanel, workoutsPage, syncStatusSource, syncHealthSource] = await Promise.all([
    readFile(headerPath, 'utf8'),
    readFile(accountPagePath, 'utf8'),
    readFile(adminPagePath, 'utf8'),
    readFile(intervalsConnectPanelPath, 'utf8'),
    readFile(workoutsPagePath, 'utf8'),
    readFile(syncStatusPagePath, 'utf8'),
    readFile(join(webRoot, 'lib/server/sync-health.ts'), 'utf8'),
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
  assert.match(account, /getSyncHealthSummary/i);
  assert.match(account, /Sync health/i);
  assert.match(account, /Last snapshot/i);
  assert.match(account, /Failure reason/i);
  assert.match(account, /Open sync status/i);
  assert.match(account, /Saving credentials here retriggers the user-scoped Intervals sync/i);
  assert.match(syncStatusSource, /getSyncHealthSummary/i);
  assert.match(syncStatusSource, /Latest worker update/i);
  assert.match(syncStatusSource, /Open configuration/i);
  assert.match(syncStatusSource, /resave the Intervals connection to restart the user-scoped sync worker/i);
  assert.match(syncHealthSource, /deriveSyncHealthLabel/i);
  assert.match(syncHealthSource, /Sync failed|Sync running|Sync queued|Waiting for first snapshot/i);
  assert.match(syncHealthSource, /Last snapshot/i);
  assert.match(syncHealthSource, /Last worker update/i);
  assert.match(admin, /redirect\(\`\$\{appRoutes\.account\}\?tab=user-management\`\)/i);
  assert.doesNotMatch(intervalsConnectPanel, /dev scaffold flow/i);
  assert.doesNotMatch(intervalsConnectPanel, /api_key=demo-key/i);
  assert.match(intervalsConnectPanel, /Intervals is mandatory in v1/i);
  assert.match(workoutsPage, /redirect\(appRoutes\.plan\)/i);
  assert.doesNotMatch(workoutsPage, /Workout export scaffold/i);
});
