# Adaptive current-week replanning and weekly decision engine implementation plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task.

Goal: turn the month planner into a more genuinely AI-powered planning tool by adding a weekly decision engine, current-week replanning based on done vs planned, scenario actions, and compact coach reasoning that updates the remaining week instead of only generating a static month draft.

Architecture: keep the core planning intelligence in apps/web/lib/server/planner-data.ts, but split it into explicit decision, recommendation, and regeneration helpers so the current draft, live Intervals context, and current-week execution state can be scored together. Add small planner month action routes for scenario-driven replanning and surface the result in the existing /app/plan and /app/calendar review shell instead of creating a separate workflow.

Tech stack: Next.js app router, existing monthly planner JSON store in planner-customization.ts, live Intervals context from planner-data.ts, Node test runner via tsx, TypeScript, existing month workout/week mutation routes.

---

Task slices:
1. Add decision-engine payloads/types and regression tests in planner-data.ts.
2. Add current-week execution comparison + remaining-week recommendation helpers.
3. Add scenario action model and route for partial replanning of the current week.
4. Surface decision/risk/remaining-week guidance in the plan page and calendar sidebar.
5. Add compact scenario controls for missed session / fatigued / fresher / reduce load / increase specificity.
6. Verify with targeted tests, typecheck, and production build.

Detailed task plan

### Task 1: Define weekly decision-engine outputs
Objective: create explicit planner outputs that describe why a week focus was chosen, what confidence/risk it carries, and what the remaining current week should optimize.

Files:
- Modify: apps/web/lib/server/planner-data.ts
- Test: apps/web/tests/planner-data.test.ts

Steps:
1. Add a failing test for a new decision payload shape in apps/web/tests/planner-data.test.ts.
   Assert that a helper can return:
   - focus: repeatability | threshold_support | race_specificity | aerobic_support | unload
   - confidence: low | medium | high
   - reasons: string[]
   - riskFlags: string[]
   - remainingWeekHours
   - remainingQualityBudget
2. Run:
   npm exec -- tsx --test tests/planner-data.test.ts
   Expected: fail because the new helper/output does not exist yet.
3. In apps/web/lib/server/planner-data.ts add types/helpers such as:
   - WeeklyDecisionFocus
   - WeeklyDecisionPayload
   - buildWeeklyDecisionPayload(live, draft, input)
4. Keep the first version deterministic, driven by:
   - goal direction / objective
   - CTL / ATL / Form
   - days to goal
   - recent category exposure
   - current-week completed load/hours
   - maxWeeklyHours and configured rest days
5. Re-run the targeted test and make it pass.

### Task 2: Add current-week compare and remaining-week recommendation helpers
Objective: make the planner explicitly compare planned vs done for the current week and produce a coach recommendation for what should happen next.

Files:
- Modify: apps/web/lib/server/planner-data.ts
- Test: apps/web/tests/planner-data.test.ts

Steps:
1. Add a failing test asserting a helper like buildCurrentWeekReplanPayload(...) returns:
   - plannedSoFar
   - completedSoFar
   - missedSessions
   - remainingDays
   - recommendedNextKeyDay
   - recommendedFocus
   - recommendationText
2. Run:
   npm exec -- tsx --test tests/planner-data.test.ts
   Expected: fail for missing helper/fields.
3. Implement the helper in planner-data.ts.
   Use:
   - first visible current week in draft
   - live today
   - completedThisWeek
   - future unlocked workouts in that week
4. Ensure it answers, in compact form:
   - what was planned
   - what got done
   - what should happen tomorrow / later this week now
5. Make the new test pass.

### Task 3: Add scenario actions for partial current-week replanning
Objective: allow explicit scenario triggers to regenerate only the remaining current week with preserved completed/locked work.

Files:
- Create: apps/web/app/api/planner/month/replan/route.ts
- Modify: apps/web/lib/server/planner-data.ts
- Modify: apps/web/lib/server/planner-customization.ts (only if helper storage fields are needed)
- Test: apps/web/tests/workout-route.test.ts or create apps/web/tests/monthly-planner-replan-route.test.ts
- Test: apps/web/tests/planner-data.test.ts

Steps:
1. Add a failing route test covering a POST body with:
   - draftId
   - scenario = missed_session | fatigued | fresher | reduce_load | increase_specificity
2. Expected route behavior:
   - preserve completed current-week work
   - preserve locked future work
   - only regenerate current-week remaining unlocked future workouts
   - redirect back to /app/plan for form callers
   - return JSON for JSON callers
3. Add planner-data helper(s) such as:
   - replanCurrentWeekForScenario(live, draft, input, scenario)
   - applyScenarioToWeeklyDecision(...)
4. For MVP scenario effects:
   - missed_session: keep quality budget but move best next key day later in week if needed
   - fatigued: downshift current-week focus and reduce total remaining cost
   - fresher: allow sharper remaining week if weekly constraints still allow
   - reduce_load: trim remaining minutes/load
   - increase_specificity: bias one remaining key day toward race_like
5. Persist only the updated week back into the draft via replaceMonthlyPlanWeek or equivalent helper.
6. Run the new route test and make it pass.

### Task 4: Surface decision intelligence in /app/plan
Objective: make the plan page show the week decision, confidence, risks, and remaining-week recommendation in a compact useful panel.

Files:
- Modify: apps/web/app/app/_components/training-plan-page.tsx
- Modify: apps/web/app/app/_components/training-plan-calendar.tsx
- Modify: apps/web/app/globals.css
- Test: apps/web/tests/ui-copy-and-layout.test.ts

Steps:
1. Add a failing UI source test checking for wiring such as:
   - weeklyDecision
   - remainingWeek
   - recommendedNextKeyDay
   - scenario action form/buttons
2. In training-plan-page.tsx build and render:
   - This week decision
   - Confidence
   - Main risks
   - Remaining week recommendation
3. In training-plan-calendar.tsx or the week summary lane, add compact fields for:
   - focus
   - next key day
   - remaining hours
4. Keep copy compact and coach-like, not verbose.
   Example structure:
   - Threshold focus
   - Confidence: medium
   - Risk: freshness tightening
   - Next best key day: Fri
5. Update CSS only as needed for a denser but useful panel.
6. Make the UI test pass.

### Task 5: Add scenario controls to the planner UI
Objective: expose a few high-value replanning actions so Tobias can steer the current week with one click.

Files:
- Modify: apps/web/app/app/_components/training-plan-page.tsx
- Possibly modify: apps/web/app/app/_components/training-plan-calendar.tsx
- Modify: apps/web/app/globals.css
- Test: apps/web/tests/ui-copy-and-layout.test.ts

Steps:
1. Add a failing UI test for visible scenario action wiring:
   - missed session
   - too fatigued
   - fresher than expected
   - reduce week
   - increase specificity
2. Add compact form buttons posting to /api/planner/month/replan.
3. For form submits, redirect back to /app/plan with a notice message.
4. Keep the controls near the current-week decision panel, not hidden inside a low-discoverability menu.
5. Make the test pass.

### Task 6: Regression verification
Objective: verify the milestone is stable and ready for the next execution step.

Files:
- No code changes unless regressions appear.

Steps:
1. Run targeted planner tests:
   npm exec -- tsx --test tests/monthly-planner-draft-route.test.ts tests/planner-data.test.ts tests/ui-copy-and-layout.test.ts tests/monthly-planner-replan-route.test.ts
   If the route test lives under another filename, use that exact file instead.
2. Run typecheck:
   npm run typecheck
3. Run production build:
   npm run build
4. If all pass, commit with a message like:
   feat: add adaptive current-week replanning and decision engine

Acceptance criteria
- The planner can compute and display a weekly decision with confidence/risk.
- The current week is explicitly compared as planned vs done.
- The user can trigger scenario-based replanning for the remaining current week.
- Replanning preserves completed sessions and locked future sessions.
- The plan page explains what should happen next this week in compact coach language.
- All targeted tests, typecheck, and build pass.

Notes for implementation
- Keep this deterministic first; do not add external LLM calls yet.
- “AI-powered” here should mean decision-aware, adaptive, and explainable within the current stack.
- If this slice works well, the next milestone should be progression continuity across weeks and change explanations vs previous draft.