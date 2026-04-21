# Monthly Planner MVP Implementation Plan

> For Hermes: implement this plan in small verified steps. Prefer TDD and keep the first shipping slice rule-based and local-state-first.

Goal: add a decisive-specific monthly planning flow on /app/plan that turns live Intervals context into a 4-week draft the athlete can review, refine, lock, and locally publish.

Architecture: keep the first version fully inside the existing Next.js planner app. Reuse `planner-data.ts` for live-context interpretation and rule-based draft generation, and expand `planner-customization.ts` into a local JSON-backed draft store for monthly planner inputs/drafts. Do not write to Intervals yet beyond a future publish adapter seam.

Tech stack: Next.js app router, server components, route handlers, local JSON store, existing live Intervals sync context, source-based UI tests.

---

## Phase 1 scope
- Confirm Context step
- Set Month Direction step
- Rule-based 4-week draft generation
- Review Draft step
- Lock/move/easier/harder/remove interactions in local draft state
- Local publish state only

## Explicitly deferred
- Real Intervals calendar writes
- Drag/drop editing
- Full freeform workout editor
- Multi-goal optimization
- Daily automatic replanning

---

## Task 1: Expand local planner store for monthly planner state

Objective: add stable JSON-backed storage for monthly inputs and generated drafts.

Files:
- Modify: `apps/web/lib/server/planner-customization.ts`
- Test: `apps/web/tests/planner-customization.test.ts` (create if missing)

Steps:
1. Add new exported types:
   - `MonthlyPlanInput`
   - `MonthlyPlanDraft`
   - `MonthlyPlanWeek`
   - `MonthlyPlanWorkout`
2. Extend `PlannerCustomizationStore` with:
   - `monthlyInputsByUser`
   - `monthlyDraftsByUser`
3. Add helpers:
   - `getLatestMonthlyPlanInput(userId)`
   - `saveMonthlyPlanInput(userId, input)`
   - `getLatestMonthlyPlanDraft(userId)`
   - `saveMonthlyPlanDraft(userId, draft)`
4. Add mutation helpers:
   - `updateMonthlyPlanWorkout(...)`
   - `lockMonthlyPlanWorkout(...)`
   - `updateMonthlyPlanWeek(...)`
5. Add tests proving ordering, persistence, and mutation behavior.

Verification:
- `npm run test -- --test-reporter=spec tests/planner-customization.test.ts`

---

## Task 2: Add monthly planner payload builders

Objective: produce decisive-specific context and draft payloads from the live state.

Files:
- Modify: `apps/web/lib/server/planner-data.ts`
- Test: `apps/web/tests/planner-data.test.ts`

Steps:
1. Add payload types:
   - `MonthlyPlannerContextPayload`
   - `MonthlyPlannerDraftPayload`
2. Add builder helpers:
   - `buildMonthlyPlannerContextPayload(live)`
   - `buildMonthlyPlannerDraftPayload(live, input)`
3. Keep generation rule-based with decisive-specific categories:
   - repeatability
n   - threshold support
   - race-like
   - endurance support
   - recovery
4. Enforce key rules:
   - no back-to-back hard days when forbidden
   - week 4 lighter by default
   - blank days become endurance support unless explicit rest
   - freshness reduces first-week density when needed
5. Add tests for context assumptions and draft-shape rules.

Verification:
- `npm run test -- --test-reporter=spec tests/planner-data.test.ts`

---

## Task 3: Add monthly planner API routes

Objective: expose context, draft creation, workout mutation, week regeneration, and local publish.

Files:
- Create: `apps/web/app/api/planner/month/context/route.ts`
- Create: `apps/web/app/api/planner/month/draft/route.ts`
- Create: `apps/web/app/api/planner/month/workout/update/route.ts`
- Create: `apps/web/app/api/planner/month/week/regenerate/route.ts`
- Create: `apps/web/app/api/planner/month/publish/route.ts`
- Test: route tests under `apps/web/tests/`

Steps:
1. Follow existing planner route auth/onboarding gating pattern.
2. Context route returns `buildMonthlyPlannerContextPayload(...)`.
3. Draft route saves monthly input and generated draft.
4. Workout update route handles actions:
   - lock
   - move_day
   - easier
   - harder
   - remove
5. Week regeneration route handles:
   - regenerate_week
   - reduce_load_10
   - increase_specificity
   - make_weekend_lighter
6. Publish route marks draft locally published and returns safety summary.

Verification:
- targeted route tests

---

## Task 4: Replace current plan page with step-based monthly planner shell

Objective: make `/app/plan` a 3-step monthly planner instead of a mostly analytical summary page.

Files:
- Modify: `apps/web/app/app/_components/training-plan-page.tsx`
- Create: `apps/web/app/app/_components/monthly-planner/confirm-context-step.tsx`
- Create: `apps/web/app/app/_components/monthly-planner/set-month-direction-step.tsx`
- Create: `apps/web/app/app/_components/monthly-planner/review-draft-step.tsx`
- Create: `apps/web/app/app/_components/monthly-planner/publish-step.tsx`
- Create: `apps/web/app/app/_components/monthly-planner/step-nav.tsx`

Steps:
1. Preserve shared `AppHero` shell.
2. Render step nav with 4 labels:
   - Confirm Context
   - Set Month Direction
   - Review Draft
   - Publish
3. Step 1 reads context payload.
4. Step 2 posts monthly objective/constraints form to draft route.
5. Step 3 reads latest stored draft and exposes controls.
6. Step 4 shows local publish confirmation and safety rules.

Verification:
- source-based UI tests
- browser QA on `/app/plan`

---

## Task 5: Build draft review components

Objective: make the draft tangible and coach-like.

Files:
- Create: `apps/web/app/app/_components/monthly-planner/week-summary-strip.tsx`
- Create: `apps/web/app/app/_components/monthly-planner/month-calendar-grid.tsx`
- Create: `apps/web/app/app/_components/monthly-planner/workout-chip.tsx`
- Create: `apps/web/app/app/_components/monthly-planner/rationale-box.tsx`
- Create: `apps/web/app/app/_components/monthly-planner/compare-recent-block.tsx`
- Modify: `apps/web/app/globals.css`

Steps:
1. Add 4-week summary strip.
2. Add month calendar grid with locked/unlocked states.
3. Add rationale panel with 3-part structure:
   - carried forward
   - protected/reduced
   - main aim
4. Add compare-vs-recent-4-weeks panel.
5. Visually distinguish:
   - quality vs support vs recovery
   - locked vs unlocked
   - generated vs modified

Verification:
- UI tests
- browser snapshot QA

---

## Task 6: Add local publish semantics and explicit ownership copy

Objective: make local publishing safe and understandable before any real Intervals write.

Files:
- Modify: monthly publish route/UI
- Test: publish route/UI tests

Steps:
1. Add explicit copy:
   - completed sessions never change
   - locked future sessions never change
   - only future unlocked sessions can be regenerated/published
2. Mark draft as locally published.
3. Show publish confirmation state on the plan page.
4. Add placeholder seam for future `planner-publish.ts` adapter.

Verification:
- tests for safety copy and state transitions

---

## Task 7: Final verification

Objective: verify planner MVP slice is stable.

Commands:
- `cd apps/web && npm run test -- --test-reporter=spec tests/planner-customization.test.ts tests/planner-data.test.ts tests/ui-copy-and-layout.test.ts tests/monthly-planner-*.test.ts`
- `cd apps/web && npm run typecheck`
- `cd /root/.hermes/profiles/profdecisive/workspace/decisive-platform && npm run build:web`
- `systemctl --user restart decisive-planner.service decisive-dashboard.service`
- live browser QA on `/app/plan`

Success criteria:
- context step shows imported assumptions clearly
- month direction form uses decisive-specific objective language
- draft renders as 4 weeks with rationale and compare panel
- lock/update/regenerate actions mutate local draft state
- publish is local-only but explicit and safe

---

## Implementation notes
- Keep generator deterministic and simple first.
- Do not block on real Intervals write support.
- Prefer local JSON persistence over premature DB/schema work.
- Keep exact intended workout structure visible in the draft; Tobias treats structure as crucial.
- Preserve future-only adaptation semantics from day one.
