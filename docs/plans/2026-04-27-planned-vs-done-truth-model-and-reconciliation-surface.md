# Planned-vs-Done Truth Model and Reconciliation Surface Implementation Plan

> For Hermes: use subagent-driven-development and commit completed slices promptly. Persist roadmap direction as the implementation evolves.

Goal: make decisive-platform explain, persist, and render the truth of what happened versus what was planned, so the planner stops feeling like a draft calendar with ad hoc mutations and becomes a reliable month/current-week execution system.

Architecture: keep the existing monthly draft store and runtime planner flow, but add one explicit reconciliation layer on top of current statuses. The next big slice should not jump to a database migration yet; instead it should formalize reconciliation events/history in the current app so current-week repair, session mutation, and month review all read from one truth model. The UI should remain calendar-first, but gain a compact reconciliation/history surface rather than hiding all truth in card tags.

Tech Stack: Next.js app router, TypeScript, node:test, current JSON-backed planner store, planner-data.ts orchestration, planner month mutation routes, current calendar/month review UI.

---

## Why this is the next big slice

We now have:
- explicit session reconciliation statuses (`skipped`, `replaced`, `completed_modified`)
- stronger mutation UX
- shared persistence mapping

But we still do not have a strong answer to:
- what was originally planned?
- what actually happened?
- what changed manually?
- which changes protected block intent versus diluted it?
- what should the coach review quickly in the current week?

That is the missing big slice before publish semantics and before a fuller workouts/export layer.

---

## Scope for this slice

In scope:
- explicit reconciliation/event entries persisted with the draft or alongside it
- deterministic event creation from planner mutations
- compact reconciliation/history payload in planner-data
- current-week and month review rendering of those entries
- summary counts for:
  - skipped
  - replaced
  - completed modified
  - moved
  - repaired via current-week replan
- a compact “truth log” / “execution changes” surface in `/app/plan`
- tests proving event creation, persistence, and rendering hooks

Out of scope:
- PostgreSQL migration
- full audit log backend
- real Intervals write-back
- deep freeform editing
- fully separate analysis/history route

---

## Product outcomes required

At the end of this slice, Tobias should be able to open the planner and quickly see:
1. what changed this week
2. whether the month is still aligned with the block intent
3. which sessions were skipped/replaced/modified
4. whether the current-week repair actions are accumulating drift
5. a compact history of planner-relevant decisions without reading raw notes on each card

---

## Proposed model

### 1. Add explicit reconciliation/event records

Do not rely only on session `status` and `reconciliationNote`.
Add a persisted event list for each draft, or a draft-scoped event list keyed by user.

Recommended v1 shape:

```ts
type MonthlyPlanReconciliationEvent = {
  id: string;
  draftId: string;
  workoutId?: string;
  weekId?: string;
  date: string;
  eventType:
    | 'workout_skipped'
    | 'workout_replaced'
    | 'workout_completed_modified'
    | 'workout_moved'
    | 'workout_locked'
    | 'week_regenerated'
    | 'week_replanned';
  title: string;
  detail: string;
  source: 'user_action' | 'planner_runtime';
  createdAt: string;
};
```

Key rule:
- event entries are append-only for v1
- session status remains the latest state
- event log provides history and explanation

### 2. Mutation routes must emit events

Routes that must create reconciliation events:
- `/api/planner/month/workout`
- `/api/planner/month/week`
- `/api/planner/month/replan`

Examples:
- skip -> `workout_skipped`
- replace_with_support -> `workout_replaced`
- mark_done_modified -> `workout_completed_modified`
- move_day -> `workout_moved`
- lock/unlock -> `workout_locked`
- regenerate week -> `week_regenerated`
- current-week scenario replan -> `week_replanned`

### 3. Planner-data should expose a compact truth payload

Add a compact payload builder that can summarize:
- latest reconciliation events
- counts by event type
- drift summary sentence
- whether current week is still on-intent or becoming diluted

Suggested builder:
- `buildPlannerTruthSummaryPayload(...)`

Suggested output:

```ts
{
  summary: '2 sessions replaced, 1 skipped, block intent still mostly intact.',
  counters: {
    skipped: 1,
    replaced: 2,
    completedModified: 1,
    moved: 3,
    repaired: 1,
  },
  currentWeekSignal: 'Current week drift is moderate but still recoverable.',
  recentEvents: [...],
}
```

### 4. UI surface

Add one compact planner section under the current-week repair panel and above/beside month details:
- title: `Execution changes`
- one summary line
- compact count chips
- latest 5 event rows

This should stay concise and scannable, not a verbose audit table.

---

## Implementation slices inside this big slice

### Task 1: Add reconciliation event persistence types and helpers

Objective: persist planner-relevant execution changes in a first-class store shape.

Files:
- Modify: `apps/web/lib/server/planner-customization.ts`
- Test: `apps/web/tests/planner-customization.test.ts`

Add:
- `MonthlyPlanReconciliationEvent` type
- store bucket for events
- helpers:
  - `listMonthlyPlanReconciliationEvents(userId, draftId)`
  - `appendMonthlyPlanReconciliationEvent(userId, input)`
  - `listRecentMonthlyPlanReconciliationEvents(userId, draftId, limit)`

Verification:
- events append in time order
- draft scoping works
- event payload remains stable across save/load

Commit:
- `feat: persist planner reconciliation events`

### Task 2: Emit reconciliation events from mutation routes

Objective: make all planner mutations create event history consistently.

Files:
- Modify: `apps/web/app/api/planner/month/workout/route.ts`
- Modify: `apps/web/app/api/planner/month/week/route.ts`
- Modify: `apps/web/app/api/planner/month/replan/route.ts`
- Test: `apps/web/tests/workout-route.test.ts`
- Test: add/extend route-source coverage for week/replan if needed

Verification:
- each relevant action writes the right event type
- event title/detail include the planned session label or week label
- replan actions write runtime-sourced events

Commit:
- `feat: emit reconciliation events from planner mutations`

### Task 3: Build planner truth summary payload

Objective: expose one compact execution-truth payload for the plan page.

Files:
- Modify: `apps/web/lib/server/planner-data.ts`
- Test: `apps/web/tests/planner-data.test.ts`

Add:
- `buildPlannerTruthSummaryPayload(...)`
- event counters
- short drift summary
- latest events list
- current-week drift signal

Verification:
- payload reflects skipped/replaced/done-modified counts
- summary remains compact
- no regressions to month compare/current-week repair payloads

Commit:
- `feat: add planner truth summary payload`

### Task 4: Render execution changes surface in the planner UI

Objective: make the truth model visible without adding clutter.

Files:
- Modify: `apps/web/app/app/_components/training-plan-page.tsx`
- Modify: `apps/web/app/globals.css`
- Test: `apps/web/tests/ui-copy-and-layout.test.ts`

UI requirements:
- compact section title: `Execution changes`
- summary line
- small count chips
- latest event rows
- should visually sit near current-week repair and month review, not in a disconnected admin surface

Verification:
- source-level UI tests for section/wiring/classes
- no regression to current compact planner layout

Commit:
- `feat: add planner execution changes surface`

### Task 5: Persist the updated direction and checkpoint the slice

Objective: keep architecture direction visible in-repo.

Files:
- Modify or add: `docs/plans/...` status note if needed

Verification:
- note reflects that planner now has first-class reconciliation history, not just session statuses

Commit:
- `docs: update planner roadmap status after truth-model slice`

---

## Testing commands

Run at each relevant slice:

```bash
npm -C apps/web test -- tests/planner-customization.test.ts tests/workout-route.test.ts tests/planner-data.test.ts tests/ui-copy-and-layout.test.ts
```

Then broader planner verification:

```bash
npm -C apps/web test -- tests/planner-data.test.ts tests/training-plan-stateful-builder-state.test.ts tests/monthly-planner-draft-route.test.ts tests/monthly-planner-parameters.test.ts tests/planner-customization.test.ts tests/workout-route.test.ts tests/ui-copy-and-layout.test.ts
```

---

## Commit discipline for this slice

Do not let this become another floating mega-diff.
Commit per coherent step:
1. persistence types/helpers
2. route event emission
3. truth payload
4. UI surface
5. docs status update

---

## Success criteria

This slice is done when:
- planner mutations append reconciliation events
- a draft has a readable recent execution history
- `/app/plan` shows a compact execution-changes surface
- planner truth is no longer only implied by card tags
- tests pass
- direction is persisted in docs and committed
