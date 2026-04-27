# Planner Parameter Contract and Scheduling Constraints Implementation Plan

> For Hermes: use subagent-driven-development and strict TDD for each task. Keep planner-data.ts as the orchestration layer, make one coherent parameter contract first, then wire only the first high-value constraint slice into month generation.

Goal: make monthly planner parameters trustworthy by aligning builder state, request normalization, persisted storage, and month generation around one canonical contract, then make the first constraint slice materially affect the generated month.

Architecture: introduce a shared monthly planner parameter module that defines the canonical contract plus mapping helpers for builder submit payload and generator input. Keep the existing route and storage surfaces stable, but stop letting each layer define its own partial shape. For the first engine slice, wire only schedule-shaping constraints that are immediately testable: max weekday minutes, unavailable dates, and explicit rest-day protection in month generation.

Tech stack: Next.js app router, TypeScript, node:test, existing planner JSON store, planner-data.ts orchestration, server route normalization, targeted planner tests, web typecheck and verify gates.

---

## Scope for this slice

In scope:
- canonical monthly planner parameter contract
- builder/client payload alignment to that contract
- route normalization alignment to that contract
- persistence compatibility for stored monthly inputs
- scheduling-constraint wiring for:
  - unavailableDates
  - maxWeekdayMinutes
  - restDay / restDaysPerWeek protection in generated month
- targeted review summaries that reflect active limits if already easy to expose from the same payload

Out of scope for this slice:
- ignore sick/vacation/non-primary-sport logic affecting diagnosis
- twoKeySessions / lighterWeekend / outdoorWeekends behavior changes
- injury suppression logic
- deeper recommendation-engine changes
- large UI redesign

---

## Current code facts to preserve

- `apps/web/app/app/_components/training-plan-stateful-builder-client.tsx` currently exposes only a compact parameter subset.
- `apps/web/app/app/_components/training-plan-stateful-builder-state.ts` defines a builder-only contract that does not cover the full stored request model.
- `apps/web/lib/server/monthly-plan-request.ts` already normalizes more fields than the builder currently exposes.
- `apps/web/lib/server/planner-customization.ts` already persists a broader `MonthlyPlanInput` shape.
- `apps/web/lib/server/planner-data.ts` currently consumes only a narrow inline input shape for `buildMonthlyPlannerDraftPayload(...)`.

The first slice should remove this drift without breaking existing imports or routes.

---

## Canonical contract target

Create one canonical module for monthly planner parameters.

Suggested file:
- Create: `apps/web/lib/planner/monthly-parameters.ts`

Suggested responsibilities:
- export canonical types for:
  - month objective
  - selected recommendation metadata
  - source-data filter parameters
  - must-follow constraints
  - scheduling preferences
  - normalized parameter bundle
- export normalization/coercion helpers used by both client-state payload building and server request parsing
- export defaults helpers for builder hydration and generator consumption

Suggested top-level type shape:

```ts
export type MonthlyPlannerObjective =
  | 'repeatability'
  | 'threshold_support'
  | 'race_specificity'
  | 'aerobic_support'
  | 'rebuild'
  | 'consistency'
  | 'taper';

export type MonthlyPlannerSelectedRecommendation = {
  source: 'primary' | 'alternative' | 'manual';
  title: string;
  objective: MonthlyPlannerObjective;
  reason?: string;
  confidence?: 'low' | 'medium' | 'high';
};

export type MonthlyPlannerMustFollow = {
  unavailableDates: string[];
  maxWeeklyHours?: number;
  maxWeekdayMinutes?: number;
  noDoubles: boolean;
  noBackToBackHardDays: boolean;
  injuryNote?: string;
};

export type MonthlyPlannerPreferences = {
  longRideDay?: string;
  strengthDays?: string[];
  outdoorWeekends?: boolean;
  twoKeySessions?: boolean;
  restDay?: string;
  restDaysPerWeek?: number;
  lighterWeekend?: boolean;
};

export type MonthlyPlannerParameters = {
  monthStart: string;
  sourceWindowDays: 28 | 42;
  ignoreSickWeek: boolean;
  ignoreVacationWeek: boolean;
  excludeNonPrimarySport: boolean;
  objective: MonthlyPlannerObjective;
  ambition: 'conservative' | 'balanced' | 'ambitious';
  selectedRecommendation?: MonthlyPlannerSelectedRecommendation;
  successMarkers: string[];
  note?: string;
  mustFollow: MonthlyPlannerMustFollow;
  preferences: MonthlyPlannerPreferences;
};
```

Keep this module dependency-light so both app client code and server code can import it safely.

---

## Task 1: Add canonical parameter contract module

Objective: create a single shared type and coercion surface for monthly planner parameters.

Files:
- Create: `apps/web/lib/planner/monthly-parameters.ts`
- Test: `apps/web/tests/monthly-planner-parameters.test.ts`

Step 1: Write failing test for defaults and coercion

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDefaultMonthlyPlannerParameters,
  coerceMonthlyPlannerParameters,
} from '../lib/planner/monthly-parameters';

test('coerceMonthlyPlannerParameters applies defaults and clamps scheduling fields', () => {
  const result = coerceMonthlyPlannerParameters({
    objective: 'repeatability',
    ambition: 'balanced',
    mustFollow: { noDoubles: true, noBackToBackHardDays: true, unavailableDates: [] },
    preferences: { restDaysPerWeek: 7 },
  }, '2026-04-24');

  assert.equal(result.monthStart, '2026-04-01');
  assert.equal(result.sourceWindowDays, 42);
  assert.equal(result.preferences.restDaysPerWeek, 3);
  assert.deepEqual(result.mustFollow.unavailableDates, []);
});
```

Step 2: Run test to verify failure

Run:
`npm test -w apps/web -- monthly-planner-parameters.test.ts`

Expected: FAIL — module or exports do not exist.

Step 3: Implement minimal shared module

Include:
- canonical types
- weekday sanitization helper if needed
- monthStart default helper
- restDaysPerWeek clamp
- sourceWindowDays coercion to 28 or 42
- array defaulting for `successMarkers` and `unavailableDates`

Step 4: Run test to verify pass

Run:
`npm test -w apps/web -- monthly-planner-parameters.test.ts`

Expected: PASS

Step 5: Commit

```bash
git add apps/web/lib/planner/monthly-parameters.ts apps/web/tests/monthly-planner-parameters.test.ts
git commit -m "refactor: add shared monthly planner parameter contract"
```

---

## Task 2: Align builder submit payload with canonical contract

Objective: stop maintaining a builder-only payload shape that drifts from the canonical parameter model.

Files:
- Modify: `apps/web/app/app/_components/training-plan-stateful-builder-state.ts`
- Test: `apps/web/tests/training-plan-stateful-builder-state.test.ts`
- Maybe modify: `apps/web/lib/planner/monthly-parameters.ts`

Step 1: Write failing test for payload coverage

Add assertions that the builder submit payload includes the first-slice fields even when defaults are used:

```ts
assert.deepEqual(payload.unavailableDates, ['2026-04-30']);
assert.equal(payload.maxWeekdayMinutes, '75');
assert.equal(payload.useLast28DaysOnly, false);
```

If the builder keeps nested objects internally, assert the submit helper returns field names the route can parse consistently.

Step 2: Run test to verify failure

Run:
`npm test -w apps/web -- training-plan-stateful-builder-state.test.ts`

Expected: FAIL — fields are missing from payload.

Step 3: Implement minimal changes

Prefer one of these patterns:
- either keep `buildBuilderSubmitPayload(...)` returning route field names
- or add a helper that converts canonical parameter state into route field names

For this slice, the payload must cover:
- `maxWeekdayMinutes`
- `unavailableDates`
- `useLast28DaysOnly`
- `ignoreSickWeek`
- `ignoreVacationWeek`
- `excludeNonPrimarySport`

Step 4: Run test to verify pass

Run:
`npm test -w apps/web -- training-plan-stateful-builder-state.test.ts`

Expected: PASS

Step 5: Commit

```bash
git add apps/web/app/app/_components/training-plan-stateful-builder-state.ts apps/web/tests/training-plan-stateful-builder-state.test.ts
 git commit -m "refactor: align planner builder payload with shared parameter contract"
```

---

## Task 3: Align request normalization with canonical contract

Objective: make route parsing return the canonical parameter shape, not an ad-hoc duplicate.

Files:
- Modify: `apps/web/lib/server/monthly-plan-request.ts`
- Test: `apps/web/tests/monthly-planner-draft-route.test.ts`
- Maybe modify: `apps/web/lib/planner/monthly-parameters.ts`

Step 1: Write failing normalization tests for first-slice fields

Add a browser-form normalization test that includes:
- `maxWeekdayMinutes`
- repeated `unavailableDates`
- `useLast28DaysOnly`
- `ignoreSickWeek`
- `ignoreVacationWeek`
- `excludeNonPrimarySport`

Assert:
- `sourceWindowDays === 28` when toggle is checked
- `mustFollow.maxWeekdayMinutes === 75`
- `mustFollow.unavailableDates` preserves all provided dates
- toggles persist as booleans

Step 2: Run test to verify failure

Run:
`npm test -w apps/web -- monthly-planner-draft-route.test.ts`

Expected: FAIL — unavailable dates and/or new fields are not normalized as expected.

Step 3: Implement minimal route normalization

Use the shared coercion helper from `monthly-parameters.ts` instead of duplicating default logic in the route file.

Important:
- keep route return type backward compatible with `MonthlyPlanInput`
- do not break JSON route usage

Step 4: Run test to verify pass

Run:
`npm test -w apps/web -- monthly-planner-draft-route.test.ts`

Expected: PASS

Step 5: Commit

```bash
git add apps/web/lib/server/monthly-plan-request.ts apps/web/tests/monthly-planner-draft-route.test.ts
 git commit -m "refactor: normalize monthly planner requests via shared contract"
```

---

## Task 4: Expose first-slice parameters in the compact builder

Objective: surface the next meaningful builder inputs without making the default UI heavy.

Files:
- Modify: `apps/web/app/app/_components/training-plan-stateful-builder-client.tsx`
- Maybe modify: `apps/web/app/app/_components/training-plan-page.tsx`
- Test: source-based UI test if needed in `apps/web/tests/ui-copy-and-layout.test.ts`

Step 1: Write failing test for visible labels if needed

Examples:
- `Weekday cap`
- `Unavailable dates`
- `Data filters`
- `Last 28 days only`

Step 2: Run test to verify failure

Run:
`npm test -w apps/web -- ui-copy-and-layout.test.ts`

Expected: FAIL — labels not present.

Step 3: Implement minimal UI additions

In `More options`, add:
- `maxWeekdayMinutes` number input
- `unavailableDates` simple comma-separated or repeatable input for this slice
- checkboxes for:
  - `useLast28DaysOnly`
  - `ignoreSickWeek`
  - `ignoreVacationWeek`
  - `excludeNonPrimarySport`

Keep default surface unchanged except for a compact active-constraints summary if cheap to add.

Step 4: Run test to verify pass

Run:
`npm test -w apps/web -- ui-copy-and-layout.test.ts`

Expected: PASS

Step 5: Commit

```bash
git add apps/web/app/app/_components/training-plan-stateful-builder-client.tsx apps/web/tests/ui-copy-and-layout.test.ts
 git commit -m "feat: expose planner constraint and data-filter parameters"
```

---

## Task 5: Add failing planner-data tests for scheduling constraints

Objective: prove the generator respects the first hard scheduling parameters before changing production code.

Files:
- Modify: `apps/web/tests/planner-data.test.ts`

Step 1: Add explicit behavior tests

Test A: unavailable dates are avoided

```ts
assert.ok(
  week.workouts.every((workout) => workout.date !== '2026-04-30'),
  'generated workouts should not land on blocked dates',
);
```

Test B: weekday sessions respect weekday cap

```ts
const weekdayWorkouts = week.workouts.filter((workout) => !/Saturday|Sunday/.test(new Date(`${workout.date}T00:00:00Z`).toUTCString()));
assert.ok(weekdayWorkouts.every((workout) => (workout.durationMinutes || 0) <= 75));
```

Test C: rest day is protected as rest/recovery only

```ts
const fridayWorkouts = week.workouts.filter((workout) => workout.date === '2026-05-01');
assert.ok(fridayWorkouts.every((workout) => workout.category === 'rest' || workout.category === 'recovery'));
```

Test D: second rest day is actually present when `restDaysPerWeek === 2`

Assert at least two low-load days appear in the week structure.

Step 2: Run test to verify failure

Run:
`npm test -w apps/web -- planner-data.test.ts`

Expected: FAIL — current generator still places sessions on blocked dates and does not fully protect weekday caps/rest-day count.

Step 3: Do not write production code until the failure is the expected behavioral failure.

Step 4: Commit nothing yet.

---

## Task 6: Wire scheduling constraints into month generation

Objective: make the monthly draft generator actually honor first-slice schedule constraints while preserving planner-data.ts as orchestration.

Files:
- Modify: `apps/web/lib/server/planner-data.ts`
- Maybe create: `apps/web/lib/server/planning/monthly-scheduling.ts`
- Test: `apps/web/tests/planner-data.test.ts`

Step 1: Implement the smallest coherent helper layer

Recommended helper extraction:
- `apps/web/lib/server/planning/monthly-scheduling.ts`

Suggested helpers:
- `isBlockedDate(...)`
- `isPreferredRestDate(...)`
- `buildWeekAvailabilityMap(...)`
- `capDurationForDay(...)`
- `countProtectedRestDays(...)`
- `placeOrShiftWorkoutDate(...)`

Keep `buildMonthlyPlannerDraftPayload(...)` orchestrating the week, but move date-selection rules into the helper module if that keeps the slice clean.

Step 2: Minimum behavior to implement

- Never schedule generated workouts on `mustFollow.unavailableDates`
- Cap weekday workout durations by `mustFollow.maxWeekdayMinutes` when set
- Keep preferred rest day free of non-recovery/non-rest work
- When `restDaysPerWeek >= 2`, protect one additional low-load day instead of leaking a normal support session into all seven days
- Preserve completed current-week workouts already in history; only shift future generated sessions

Step 3: Run planner test to verify pass

Run:
`npm test -w apps/web -- planner-data.test.ts`

Expected: PASS

Step 4: Sanity-check payload consumers

Run:
`npm test -w apps/web -- monthly-planner-draft-route.test.ts training-plan-stateful-builder-state.test.ts`

Expected: PASS

Step 5: Commit

```bash
git add apps/web/lib/server/planner-data.ts apps/web/lib/server/planning/monthly-scheduling.ts apps/web/tests/planner-data.test.ts
 git commit -m "feat: apply planner scheduling constraints to monthly drafts"
```

---

## Task 7: Full verification gates

Objective: prove the slice is stable enough to keep building on.

Files:
- No code changes required unless a gate fails

Step 1: Run targeted planner tests

Run:
`npm test -w apps/web -- monthly-planner-parameters.test.ts training-plan-stateful-builder-state.test.ts monthly-planner-draft-route.test.ts planner-data.test.ts`

Expected: PASS

Step 2: Run typecheck

Run:
`npm run typecheck:web`

Expected: PASS

Step 3: Run fast verify

Run:
`npm run verify:web:fast`

Expected: PASS

Step 4: Inspect diff shape

Run:
`git diff --stat`

Expected: limited to shared parameter contract, builder, request normalization, scheduling helper/generator, and related tests.

Step 5: Final commit if needed

```bash
git add docs/plans/2026-04-24-planner-parameter-contract-and-scheduling-constraints.md
 git commit -m "docs: add planner parameter contract implementation plan"
```

---

## Design guardrails

- Do not let the builder invent another new parameter shape.
- Do not make planner-data.ts consume raw form field names directly.
- Do not combine source-data filtering heuristics with schedule-constraint wiring in this slice.
- Do not expand the visible UI more than necessary; keep default surface compact.
- Preserve existing import surfaces where tests or routes already depend on them.

---

## Acceptance criteria

The slice is complete when all of these are true:
- one canonical parameter contract exists and is reused across client/server boundaries
- builder payload includes the first-slice parameters consistently
- request normalization persists the first-slice parameters correctly
- generated monthly drafts avoid unavailable dates
- weekday durations respect `maxWeekdayMinutes` when set
- preferred rest day is protected in generated future sessions
- second rest day can be reflected when requested
- targeted planner tests, typecheck, and fast verify all pass

---

## Next slice after this one

After this lands, the next best slice is data-filter-driven diagnosis:
- `useLast28DaysOnly`
- `ignoreSickWeek`
- `ignoreVacationWeek`
- `excludeNonPrimarySport`

That slice should change `buildTrainingNeedsSummary(...)` inputs and recommendation quality, not just the builder form.
