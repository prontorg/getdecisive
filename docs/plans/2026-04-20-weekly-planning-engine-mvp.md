# Weekly Planning Engine MVP Implementation Plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task.

Goal: replace the legacy current_week_plan.md week-plan source with a shared weekly planning engine that produces an intended week, a daily adaptation decision, and explicit rationale for dashboard + planner.

Architecture: add a dedicated planning runtime under apps/web/lib/server/planning that assembles frozen inputs from the latest user-scoped Intervals snapshot plus stable athlete/goal context, generates an active weekly cycle and a daily decision, persists both in a new planning store, and makes dashboard + planner read that state first. Keep current_week_plan.md only as fallback/export compatibility until the new runtime is trusted.

Tech Stack: Next.js app routes, TypeScript server modules, existing auth-store/sync-store/planner-customization abstractions, JSON-backed store for MVP with Postgres-ready interfaces, existing node:test/tsx test suite.

---

## Existing codebase anchors to reuse

- User-scoped live snapshot lookup:
  - apps/web/lib/server/sync-store.ts
  - apps/web/lib/server/planner-data.ts
- Stable customization store already used for goals + adaptations + monthly drafts:
  - apps/web/lib/server/planner-customization.ts
- Current planner generation heuristics that should inform but not own the new engine:
  - apps/web/lib/server/planner-data.ts
- Shared app context/auth lookup:
  - apps/web/lib/server/auth-store.ts
  - apps/web/lib/server/app-context.ts
- Existing tests to extend first:
  - apps/web/tests/planner-data.test.ts
  - apps/web/tests/ui-copy-and-layout.test.ts
- Legacy fallback mechanism to retire later:
  - scripts/intervals_coach.py
  - scripts/intervals_dashboard.py

## Target MVP behavior

1. Generate one active weekly planning cycle per athlete for a rolling Monday→Sunday week.
2. Generate one daily decision for today anchored to live calendar date.
3. Dashboard reads:
   - week intention
   - this week planned structure
   - what should actually happen today
   - what tomorrow should likely become
   - why this is the call
4. Planner reads the same active planning cycle for week truth.
5. Legacy markdown is used only when no active planning cycle exists.

## New file map

Create:
- apps/web/lib/server/planning/types.ts
- apps/web/lib/server/planning/assemble-planning-input.ts
- apps/web/lib/server/planning/planning-rules.ts
- apps/web/lib/server/planning/generate-weekly-cycle.ts
- apps/web/lib/server/planning/generate-daily-decision.ts
- apps/web/lib/server/planning/planning-store.ts
- apps/web/app/api/planning/week/active/route.ts
- apps/web/app/api/planning/week/generate/route.ts
- apps/web/app/api/planning/day/decide/route.ts
- apps/web/tests/planning-store.test.ts
- apps/web/tests/planning-engine.test.ts

Modify:
- apps/web/lib/server/planner-customization.ts
- apps/web/lib/server/planner-data.ts
- apps/web/app/app/dashboard/page.tsx
- apps/web/app/app/_components/training-plan-page.tsx
- apps/web/tests/planner-data.test.ts
- apps/web/tests/ui-copy-and-layout.test.ts

---

### Task 1: Add core planning runtime types

Objective: define explicit TypeScript types for weekly cycles, day plans, daily decisions, planning input snapshots, and planning events.

Files:
- Create: apps/web/lib/server/planning/types.ts
- Test: apps/web/tests/planning-engine.test.ts

Step 1: Write failing type-shape test

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import type { PlanningCycle, PlanningDay, DailyDecision } from '../lib/server/planning/types';

test('planning runtime types cover cycle, day, and decision records', () => {
  const cycleStatus: PlanningCycle['status'] = 'active';
  const dayStatus: PlanningDay['status'] = 'planned';
  const confidence: DailyDecision['confidence'] = 'high';
  assert.equal(cycleStatus, 'active');
  assert.equal(dayStatus, 'planned');
  assert.equal(confidence, 'high');
});
```

Step 2: Run test to verify failure

Run: `npm run test -- planning-engine.test.ts`
Expected: FAIL — module ../lib/server/planning/types not found

Step 3: Write minimal implementation

Add copy-pasteable exported types in apps/web/lib/server/planning/types.ts:
- PlanningCycleStatus = 'draft' | 'active' | 'superseded'
- PlanningGenerationReason = 'scheduled_weekly' | 'manual_regenerate' | 'major_context_change'
- PlannedType = 'rest' | 'recovery' | 'endurance' | 'threshold_support' | 'repeatability' | 'race_like' | 'sharpness'
- PlanningPriority = 'key' | 'support' | 'optional'
- MissedPolicy = 'move' | 'downgrade' | 'skip'
- PlanningDayStatus = 'planned' | 'done' | 'adapted' | 'skipped' | 'moved'
- PlanningConfidence = 'high' | 'medium' | 'low'
- PlanningInputSnapshot
- PlanningCycle
- PlanningDay
- DailyDecision
- PlanningEvent

Step 4: Run test to verify pass

Run: `npm run test -- planning-engine.test.ts`
Expected: PASS

Step 5: Commit

```bash
git add apps/web/lib/server/planning/types.ts apps/web/tests/planning-engine.test.ts
git commit -m "feat: add planning runtime types"
```

---

### Task 2: Extend planner customization store with stable planning context

Objective: persist stable athlete-planning context without mixing it into the monthly draft types.

Files:
- Modify: apps/web/lib/server/planner-customization.ts
- Test: apps/web/tests/planning-store.test.ts

Step 1: Write failing storage test

Add test covering read/write of a new stable context record:

```ts
test('planning context store persists stable athlete planning inputs', async () => {
  const { savePlanningContext, getPlanningContext } = await import('../lib/server/planner-customization');
  await savePlanningContext('user_1', {
    disciplineFocus: 'track_endurance',
    thresholdAnchorW: 365,
    preferredRestDay: 'Saturday',
    maxWeeklyHours: 10,
    noBackToBackHardDays: true,
    blankDayDefault: 'support_endurance',
  });
  const saved = await getPlanningContext('user_1');
  assert.equal(saved?.thresholdAnchorW, 365);
  assert.equal(saved?.preferredRestDay, 'Saturday');
});
```

Step 2: Run test to verify failure

Run: `npm run test -- planning-store.test.ts`
Expected: FAIL — savePlanningContext/getPlanningContext missing

Step 3: Write minimal implementation

In planner-customization.ts:
- add type PlanningContext
- extend PlannerCustomizationStore with `planningContextByUser: Record<string, PlanningContext>`
- seed + load defaults
- export:
  - `getPlanningContext(userId)`
  - `savePlanningContext(userId, context)`

Keep this independent from monthlyInputsByUser/monthlyDraftsByUser.

Step 4: Run test to verify pass

Run: `npm run test -- planning-store.test.ts`
Expected: PASS

Step 5: Commit

```bash
git add apps/web/lib/server/planner-customization.ts apps/web/tests/planning-store.test.ts
git commit -m "feat: persist stable planning context"
```

---

### Task 3: Add planning input assembler

Objective: build one frozen planning input snapshot from stable context, goal context, live snapshot, and execution state.

Files:
- Create: apps/web/lib/server/planning/assemble-planning-input.ts
- Test: apps/web/tests/planning-engine.test.ts

Step 1: Write failing test

```ts
import { assemblePlanningInput } from '../lib/server/planning/assemble-planning-input';

test('assemblePlanningInput combines stable context, goals, live state, and execution state', async () => {
  const assembled = await assemblePlanningInput({
    userId: 'user_1',
    stableContext: {
      disciplineFocus: 'track_endurance',
      thresholdAnchorW: 365,
      preferredRestDay: 'Saturday',
      maxWeeklyHours: 10,
      noBackToBackHardDays: true,
      blankDayDefault: 'support_endurance',
    },
    liveState: {
      today: '2026-04-20',
      goal_race_date: '2026-05-12',
      wellness: { ctl: 102, atl: 110 },
      recent_rows: [
        { activity_id: 'a1', start_date_local: '2026-04-19T09:00:00', session_type: 'threshold / race-support ride', training_load: 140, duration_s: 7200, summary: { short_label: '3x15 threshold' } },
      ],
    } as any,
    goalEntries: [{ id: 'g1', type: 'race', title: 'A race', targetDate: '2026-05-12', status: 'active', priority: 'A', updatedAt: '2026-04-20T00:00:00Z' }],
  });
  assert.equal(assembled.goalContext.keyEventDate, '2026-05-12');
  assert.equal(assembled.athleteContext.thresholdAnchorW, 365);
  assert.equal(assembled.liveContext.today, '2026-04-20');
});
```

Step 2: Run test to verify failure

Run: `npm run test -- planning-engine.test.ts`
Expected: FAIL — module/function missing

Step 3: Write minimal implementation

Implement `assemblePlanningInput(...)` that returns:
- id
- athleteId
- capturedAt
- athleteContext
- goalContext
- liveContext
- executionContext

Include helper functions for:
- current week completed rows
- recent session counts
- freshness band from form
- key event resolution from goal entries and live state

Step 4: Run test to verify pass

Run: `npm run test -- planning-engine.test.ts`
Expected: PASS

Step 5: Commit

```bash
git add apps/web/lib/server/planning/assemble-planning-input.ts apps/web/tests/planning-engine.test.ts
git commit -m "feat: assemble weekly planning input snapshots"
```

---

### Task 4: Add explicit planning rules library

Objective: isolate deterministic cycling rules so generator behavior is inspectable and testable.

Files:
- Create: apps/web/lib/server/planning/planning-rules.ts
- Test: apps/web/tests/planning-engine.test.ts

Step 1: Write failing rule tests

Add tests for:
- default key session count = 2 in build week
- race-week reduces overload ambition
- no-back-to-back-hard-days validator returns false for adjacent hard days
- blank day defaults to support endurance

Step 2: Run test to verify failure

Run: `npm run test -- planning-engine.test.ts`
Expected: FAIL — missing functions

Step 3: Write minimal implementation

Export pure functions such as:
- `resolvePhaseType(input)`
- `resolveWeeklyFocus(input)`
- `defaultKeySessionCount(input)`
- `canPlaceHardDay(existingDays, candidateDate, context)`
- `fallbackPlannedTypeForOpenDay(context)`
- `shouldMoveMissedSession(args)`
- `downgradeForFatigue(day, liveContext)`

Keep functions pure and dependency-free.

Step 4: Run test to verify pass

Run: `npm run test -- planning-engine.test.ts`
Expected: PASS

Step 5: Commit

```bash
git add apps/web/lib/server/planning/planning-rules.ts apps/web/tests/planning-engine.test.ts
git commit -m "feat: add planning rules library"
```

---

### Task 5: Build weekly cycle generator

Objective: generate a Monday→Sunday intended week from assembled inputs and rules.

Files:
- Create: apps/web/lib/server/planning/generate-weekly-cycle.ts
- Test: apps/web/tests/planning-engine.test.ts

Step 1: Write failing generator test

```ts
import { generateWeeklyCycle } from '../lib/server/planning/generate-weekly-cycle';

test('generateWeeklyCycle creates a balanced build week with key anchors and support days', () => {
  const cycle = generateWeeklyCycle(samplePlanningInput);
  assert.equal(cycle.days.length, 7);
  assert.equal(cycle.days.filter((day) => day.priority === 'key').length, 2);
  assert.equal(cycle.days.some((day) => day.plannedType === 'rest'), true);
  assert.equal(cycle.days.some((day) => day.plannedType === 'endurance'), true);
});
```

Step 2: Run test to verify failure

Run: `npm run test -- planning-engine.test.ts`
Expected: FAIL

Step 3: Write minimal implementation

Implement generator that:
- anchors to Monday of `liveContext.today`
- creates cycle meta:
  - validFrom
  - validTo
  - primaryFocus
  - phaseType
  - confidence
  - risks
- creates 7 day objects
- places:
  - 1 rest/recovery anchor
  - 2 key sessions max by default
  - support endurance on blank/open days
- respects preferred rest day and no-back-to-back-hard-days

Do not overfit. Use simple deterministic placement.

Step 4: Run test to verify pass

Run: `npm run test -- planning-engine.test.ts`
Expected: PASS

Step 5: Commit

```bash
git add apps/web/lib/server/planning/generate-weekly-cycle.ts apps/web/tests/planning-engine.test.ts
git commit -m "feat: generate weekly planning cycles"
```

---

### Task 6: Build daily decision generator

Objective: generate today’s actual recommendation from active cycle plus live execution/freshness.

Files:
- Create: apps/web/lib/server/planning/generate-daily-decision.ts
- Test: apps/web/tests/planning-engine.test.ts

Step 1: Write failing tests

Cover:
- threshold completed today -> tomorrow likely supportive
- high fatigue -> key day downgraded
- missed key session is not always moved

Step 2: Run test to verify failure

Run: `npm run test -- planning-engine.test.ts`
Expected: FAIL

Step 3: Write minimal implementation

Implement `generateDailyDecision({ cycle, input })` returning:
- plannedForToday
- actualRecommendationForToday
- plannedForTomorrow
- likelyTomorrowAfterToday
- recommendedNextKeyDay
- confidence
- reasonSummary
- risks
- decisionBasis

Use simple rules from planning-rules.ts.

Step 4: Run test to verify pass

Run: `npm run test -- planning-engine.test.ts`
Expected: PASS

Step 5: Commit

```bash
git add apps/web/lib/server/planning/generate-daily-decision.ts apps/web/tests/planning-engine.test.ts
git commit -m "feat: add daily planning adaptation decisions"
```

---

### Task 7: Add planning store abstraction

Objective: persist active planning cycles and daily decisions outside the UI layer.

Files:
- Create: apps/web/lib/server/planning/planning-store.ts
- Modify: apps/web/lib/server/planner-customization.ts
- Test: apps/web/tests/planning-store.test.ts

Step 1: Write failing store tests

Add tests for:
- save active cycle
- get active cycle for athlete
- supersede old cycle when new one is saved
- save/get latest daily decision

Step 2: Run test to verify failure

Run: `npm run test -- planning-store.test.ts`
Expected: FAIL

Step 3: Write minimal implementation

For MVP, use JSON-backed storage inside planner-customization store with new keys:
- planningCyclesByUser
- dailyDecisionsByUser
- planningInputSnapshotsByUser

In planning-store.ts export:
- `savePlanningInputSnapshot(userId, snapshot)`
- `getLatestPlanningInputSnapshot(userId)`
- `savePlanningCycle(userId, cycle)`
- `getActivePlanningCycle(userId)`
- `saveDailyDecision(userId, decision)`
- `getLatestDailyDecision(userId)`
- `generateAndActivateWeeklyCycle(userId, deps?)`
- `generateDailyDecisionForToday(userId, deps?)`

Mark prior active cycle as superseded when saving a new active cycle.

Step 4: Run test to verify pass

Run: `npm run test -- planning-store.test.ts`
Expected: PASS

Step 5: Commit

```bash
git add apps/web/lib/server/planning/planning-store.ts apps/web/lib/server/planner-customization.ts apps/web/tests/planning-store.test.ts
git commit -m "feat: add planning state store"
```

---

### Task 8: Add planning API routes

Objective: expose the active weekly plan and generation endpoints for dashboard/planner consumption.

Files:
- Create: apps/web/app/api/planning/week/active/route.ts
- Create: apps/web/app/api/planning/week/generate/route.ts
- Create: apps/web/app/api/planning/day/decide/route.ts
- Test: apps/web/tests/planner-data.test.ts

Step 1: Write failing route tests

Add tests that verify:
- unauthenticated returns 401/redirect
- active route returns cycle + today decision
- generate route creates active cycle
- decide route returns today decision

Step 2: Run test to verify failure

Run: `npm run test -- planner-data.test.ts`
Expected: FAIL

Step 3: Write minimal implementation

Each route should:
- resolve session user id
- ensure onboarding is ready
- call planning-store helpers
- return JSON

Suggested response shape for GET /api/planning/week/active:
```json
{
  "cycle": { ... },
  "todayDecision": { ... },
  "snapshotCapturedAt": "..."
}
```

Step 4: Run test to verify pass

Run: `npm run test -- planner-data.test.ts`
Expected: PASS

Step 5: Commit

```bash
git add apps/web/app/api/planning/week/active/route.ts apps/web/app/api/planning/week/generate/route.ts apps/web/app/api/planning/day/decide/route.ts apps/web/tests/planner-data.test.ts
git commit -m "feat: add planning engine API routes"
```

---

### Task 9: Add planner-data bridge helpers

Objective: provide one server-side helper that surfaces active planning state to dashboard and planner.

Files:
- Modify: apps/web/lib/server/planner-data.ts
- Test: apps/web/tests/planner-data.test.ts

Step 1: Write failing test

Add test for a helper like `getActivePlanningContext(userId)` returning:
- active cycle
- latest decision
- snapshot timestamp

Step 2: Run test to verify failure

Run: `npm run test -- planner-data.test.ts`
Expected: FAIL

Step 3: Write minimal implementation

In planner-data.ts add:
- `getActivePlanningContext(userId)`
- resolves existing authenticated planner context
- reads active planning cycle + latest daily decision
- falls back to old month/week payload logic only if no active cycle exists

Step 4: Run test to verify pass

Run: `npm run test -- planner-data.test.ts`
Expected: PASS

Step 5: Commit

```bash
git add apps/web/lib/server/planner-data.ts apps/web/tests/planner-data.test.ts
git commit -m "feat: bridge planning runtime into planner data layer"
```

---

### Task 10: Wire dashboard to active planning state first

Objective: make dashboard week-plan truth come from planning runtime, not legacy markdown, while preserving fallback.

Files:
- Modify: apps/web/app/app/dashboard/page.tsx
- Modify: scripts/intervals_dashboard.py
- Test: apps/web/tests/ui-copy-and-layout.test.ts

Step 1: Write failing UI/source test

Assert new source usage markers in dashboard page / embedded dashboard fetch path.

Suggested source assertions:
- dashboard page reads active planning context helper
- dashboard source contains labels:
  - Week intention
  - What should actually happen today
  - Why this is the call

Step 2: Run test to verify failure

Run: `npm run test -- --test-reporter=spec tests/ui-copy-and-layout.test.ts`
Expected: FAIL

Step 3: Write minimal implementation

Dashboard page:
- fetch active planning context server-side
- pass values into hero/summary UI

Python dashboard:
- for MVP, do not move generation into Python
- only allow it to keep rendering legacy fallback if app-side planning context absent

Do not let Python remain the only planning source.

Step 4: Run test to verify pass

Run: `npm run test -- --test-reporter=spec tests/ui-copy-and-layout.test.ts`
Expected: PASS

Step 5: Commit

```bash
git add apps/web/app/app/dashboard/page.tsx scripts/intervals_dashboard.py apps/web/tests/ui-copy-and-layout.test.ts
git commit -m "feat: drive dashboard week plan from planning runtime"
```

---

### Task 11: Wire planner to the same active planning state

Objective: show the intended active week in the planner surface without making monthly drafts the source of truth.

Files:
- Modify: apps/web/app/app/_components/training-plan-page.tsx
- Test: apps/web/tests/ui-copy-and-layout.test.ts

Step 1: Write failing UI/source test

Assert planner page now references active planning context and exposes:
- week intention
- last updated timestamp
- active-week rationale

Step 2: Run test to verify failure

Run: `npm run test -- --test-reporter=spec tests/ui-copy-and-layout.test.ts`
Expected: FAIL

Step 3: Write minimal implementation

Inside TrainingPlanPage:
- load active planning context in addition to monthly draft
- show active planning cycle as truth for current week context panel
- keep monthly draft generation for month editing only
- do not replace entire monthly draft UX yet

Step 4: Run test to verify pass

Run: `npm run test -- --test-reporter=spec tests/ui-copy-and-layout.test.ts`
Expected: PASS

Step 5: Commit

```bash
git add apps/web/app/app/_components/training-plan-page.tsx apps/web/tests/ui-copy-and-layout.test.ts
git commit -m "feat: surface active planning cycle in planner"
```

---

### Task 12: Add fallback/export bridge to legacy current_week_plan.md

Objective: preserve compatibility while demoting markdown to a projection of active planning state.

Files:
- Modify: scripts/intervals_coach.py
- Test: apps/web/tests/planner-data.test.ts or apps/web/tests/planning-engine.test.ts

Step 1: Write failing test

Add test that active planning cycle can be rendered to weekday short lines for legacy consumers.

Step 2: Run test to verify failure

Run: `npm run test -- planning-engine.test.ts`
Expected: FAIL

Step 3: Write minimal implementation

Add a tiny exporter/helper that converts active cycle to:
- Mon: ...
- Tue: ...
...

Do not let markdown become the generator. It should be a projection only.

Step 4: Run test to verify pass

Run: `npm run test -- planning-engine.test.ts`
Expected: PASS

Step 5: Commit

```bash
git add scripts/intervals_coach.py apps/web/tests/planning-engine.test.ts
git commit -m "feat: export active planning cycle to legacy week-plan format"
```

---

### Task 13: Full verification

Objective: verify the planning engine MVP end-to-end.

Files:
- No new files; run verification commands

Step 1: Run targeted tests

Run:
```bash
cd /root/.hermes/profiles/profdecisive/workspace/decisive-platform/apps/web
npm run test -- planning-store.test.ts planning-engine.test.ts planner-data.test.ts
npm run test -- --test-reporter=spec tests/ui-copy-and-layout.test.ts
```

Expected: PASS

Step 2: Run typecheck

Run:
```bash
cd /root/.hermes/profiles/profdecisive/workspace/decisive-platform/apps/web
npm run typecheck
```

Expected: PASS

Step 3: Run app build

Run:
```bash
cd /root/.hermes/profiles/profdecisive/workspace/decisive-platform
npm run build:web
```

Expected: PASS

Step 4: Restart services

Run:
```bash
systemctl --user restart decisive-dashboard.service decisive-planner.service
systemctl --user status decisive-dashboard.service --no-pager
systemctl --user status decisive-planner.service --no-pager
```

Expected: both active

Step 5: Manual product verification

Check:
- dashboard current week comes from active planning cycle when present
- planner current week context matches dashboard
- daily recommendation explains why, not just what
- missing active cycle falls back safely
- last updated timestamp remains visible

Step 6: Commit verification-safe final state

```bash
git add apps/web scripts/intervals_dashboard.py docs/plans
git commit -m "feat: add weekly planning engine MVP"
```

---

## Non-goals for MVP

Do not do these yet:
- full athlete-specific machine learning
- replacing monthly draft UX entirely
- advanced coach override flows
- full Postgres planning migration if it blocks shipping the logic
- weather-aware planning mutation
- automatic planner drag/drop rewrite around the new engine

## Design constraints to preserve

- Anchor all daily logic to live today first.
- Distinguish intended plan from actual recommendation.
- Blank days still default to support endurance unless rules say otherwise.
- Prioritize track-endurance outcomes: repeatability, race specificity, freshness protection.
- Threshold supports racing; it is not the only organizing principle.
- Keep rationale explicit and compact.

## Ready-for-execution note

Plan complete and saved. Ready to execute task-by-task using subagent-driven-development if you want me to start implementation.