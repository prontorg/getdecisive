# AI-Guided Planning Workspace Implementation Plan

> For Hermes: use this as the product and implementation reference before changing more planner UI. Implement in small verified slices, prefer TDD, and keep each completed slice committed, deployed, and pushed.

Goal: turn decisive-platform planning from a button-heavy draft editor into the core product workflow: a clear AI-guided planning workspace that connects live Insight, structured planning decisions, generated calendar drafts, and automatic runtime updates.

Architecture: keep the product centered on one canonical planning workspace at `/app/plan`, but split its logic into four explicit layers: live understanding, AI recommendation, structured decision state, and editable calendar result. Reuse the existing live/runtime/draft infrastructure, but introduce a new persisted planning-session state so the system can track recommendation → user choice → generated draft → runtime updates as one coherent flow.

Tech stack: Next.js app router, server components, route handlers, existing planner runtime and monthly draft store, local JSON-backed persisted state first, shared server payloads for Insight + Plan, source-based UI tests, live browser QA.

---

## Product vision

### Core principle
The platform should feel like:
1. Insight tells me what is happening.
2. Plan tells me what should happen next.
3. Calendar makes it concrete.
4. Runtime keeps it updated automatically.

### Target user experience
The athlete should be able to open Plan and immediately understand:
- what the system knows right now
- what changed since the last update
- what the AI recommends next
- which planning direction is selected
- what is editable versus fixed
- how the recommendation became the visible calendar

### Product model
Do not jump straight to a freeform chatbot.
The right target is a structured conversational planner:
- AI explains current state and recommends a direction
- athlete chooses or tunes one of a few meaningful options
- platform generates the draft
- athlete reviews and adjusts the result
- live runtime keeps current week honest

This should feel conversational, but remain constrained, explainable, and trustworthy.

---

## What is wrong today

### Current pain points
- too many visible actions at once
- unclear order of operations
- weak distinction between live truth, AI recommendation, editable draft, and completed work
- Plan and Insight feel related but not truly connected
- unclear which parts are fully working versus local-only or placeholder-like

### Root cause
The planner has useful logic already, but lacks a clear product orchestration layer.
It behaves like multiple tools on one page rather than one planning system.

### Implication
Do not keep adding more actions to the current structure without first introducing:
- a canonical planning state model
- clear section order
- shared terminology
- shared data flow between Insight and Plan

---

## Target IA and screen concept

## `/app/insight`
Purpose: understanding, not editing.

Sections:
1. Current state
   - CTL / ATL / Form
   - freshness
   - last updated
   - what changed recently
2. Recent execution
   - last activity analysis
   - recent pattern
   - repeatability / threshold / race-like mix
3. Planning relevance
   - key opportunity
   - key risk
   - next key day
   - planning summary teaser with CTA into Plan

## `/app/plan`
Purpose: decide and build.

Ordered sections:
1. Understand
2. Decide
3. Build
4. Review
5. Publish / Export

This should be one continuous page with a sticky step nav, not a disconnected tool dashboard.

## `/app/calendar`
Purpose: optional alternate dense calendar view.

Rule:
- keep `/app/plan` as the primary planning workflow
- `/app/calendar` can remain as a focused full-calendar surface, but should not be the main post-generate destination

---

## Planner flow concept

## Section 1: Understand
Objective: show only the planning-relevant truth.

Visible content:
- synced / last updated
- goal / event timing
- planned today
- actually today
- planned tomorrow
- tomorrow likely becomes
- freshness
- recent pattern
- key risk
- key opportunity

Key UX rule:
This is not a general dashboard dump. It should answer:
- where am I now?
- what matters most?
- what changed?

## Section 2: Decide
Objective: become the AI-guided conversation layer.

Visible content:
- primary recommendation
- confidence
- why this is the recommendation
- 2-3 alternative directions
- compact actions:
  - accept
  - safer
  - harder
  - more race-like
  - explain why
  - show another option

Key UX rule:
Do not begin with a big form. Begin with a recommendation and a small set of meaningful responses.

## Section 3: Build
Objective: confirm a few key constraints and generate a draft.

Visible controls only:
- main objective / selected direction
- ambition
- max weekly hours
- rest day / rest-day count
- long ride day
- no back-to-back hard days
- optional note

Key UX rule:
This is confirmation and tuning, not planner admin.
Advanced options should sit behind a compact “More constraints” disclosure.

## Section 4: Review
Objective: show the current week and next 4 weeks in a meaningful order.

Sub-order:
1. This week now
   - live runtime summary
   - next key day
   - what changed
2. This week editable bridge
   - current-week scenario actions
3. Next 4 weeks
   - calendar
   - week intent
   - compare vs recent
4. Adjustments
   - move, easier, harder, lock, remove

Key UX rule:
Review must explain sequence first, editability second.

## Section 5: Publish / Export
Objective: make output state explicit.

Visible content:
- local draft status
- locally published status
- future export/sync state
- what publish affects and what it does not affect

Key UX rule:
Keep this explicit and calm. No ambiguity about live runtime versus future draft publishing.

---

## Data model changes needed

## 1. Introduce planning session state
Objective: track recommendation → user choice → draft generation as one object.

Files:
- Modify: `apps/web/lib/server/planner-customization.ts`
- Test: `apps/web/tests/planner-customization.test.ts`

Add types:
- `PlanningWorkspaceSession`
- `PlanningRecommendation`
- `PlanningDirectionOption`
- `PlanningWorkspaceSelection`
- `PlanningWorkspaceStatus`

Suggested shape:
- `id`
- `userId`
- `createdAt`
- `updatedAt`
- `liveSnapshotDate`
- `recommendation`
- `alternatives`
- `selectedDirection`
- `constraintOverrides`
- `latestDraftId`
- `status`
  - `understanding`
  - `direction_selected`
  - `draft_generated`
  - `draft_published`
- `lastChangeSummary`

Purpose:
This becomes the canonical source for “where the athlete is in the planning flow”.

## 2. Add shared plan/insight summary payload
Objective: power both Insight and Plan from one summary source.

Files:
- Modify: `apps/web/lib/server/planner-data.ts`
- Test: `apps/web/tests/planner-data.test.ts`

Add payload:
- `PlanningSummaryPayload`

Fields:
- `lastUpdated`
- `goalSummary`
- `todaySummary`
- `tomorrowSummary`
- `freshnessSummary`
- `recentPattern`
- `keyRisk`
- `keyOpportunity`
- `nextKeyDay`
- `changeSummary`

Purpose:
Insight renders this as analysis.
Plan renders this as action context.

## 3. Add recommendation payload generation
Objective: separate recommendation from draft generation.

Files:
- Modify: `apps/web/lib/server/planner-data.ts`
- Test: `apps/web/tests/planner-data.test.ts`

Add:
- `buildPlanningRecommendationPayload(live, goals, latestInput?, latestDraft?)`

Output:
- primary recommendation
- alternatives
- confidence
- rationale
- risks
- recommended constraints

Key rule:
Draft generation should become downstream of recommendation selection, not the first visible action.

---

## Routing and API design

## Add planning workspace routes
Files:
- Create: `apps/web/app/api/planner/workspace/recommendation/route.ts`
- Create: `apps/web/app/api/planner/workspace/select-direction/route.ts`
- Create: `apps/web/app/api/planner/workspace/generate-draft/route.ts`
- Create: `apps/web/app/api/planner/workspace/status/route.ts`

Responsibilities:
- `recommendation`: compute and persist the latest planning session recommendation
- `select-direction`: persist chosen direction or “safer / harder / race-like” adjustment
- `generate-draft`: turn selected direction + constraints into a monthly draft
- `status`: return current workspace state for the page shell and async refreshes

Keep existing month routes for actual draft mutations:
- `/api/planner/month/draft`
- `/api/planner/month/replan`
- `/api/planner/month/week`
- `/api/planner/month/workout`
- `/api/planner/month/publish`

But over time the main UI should call them through the clearer planning workspace flow.

---

## UI implementation plan

## Phase A: restructure `/app/plan` around the new mental model
Objective: make the planner understandable before adding more AI interactions.

Files:
- Modify: `apps/web/app/app/_components/training-plan-page.tsx`
- Create: `apps/web/app/app/_components/planning-workspace/planning-step-nav.tsx`
- Create: `apps/web/app/app/_components/planning-workspace/planning-state-banner.tsx`
- Create: `apps/web/app/app/_components/planning-workspace/understand-section.tsx`
- Create: `apps/web/app/app/_components/planning-workspace/decide-section.tsx`
- Create: `apps/web/app/app/_components/planning-workspace/build-section.tsx`
- Create: `apps/web/app/app/_components/planning-workspace/review-section.tsx`
- Modify: `apps/web/app/globals.css`
- Test: `apps/web/tests/ui-copy-and-layout.test.ts`

Deliverables:
- sticky step nav
- single workspace state banner
- explicit terminology for:
  - live truth
  - AI recommendation
  - selected direction
  - editable draft
  - completed work
  - published state

## Phase B: add recommendation-first planning
Objective: make planning feel AI-guided rather than form-led.

Files:
- Modify: `training-plan-page.tsx`
- Create: `planning-recommendation-card.tsx`
- Create: `planning-direction-options.tsx`
- Test: planner-data + UI tests

Deliverables:
- primary recommendation card
- alternatives list
- confidence/rationale/risk block
- actions for “accept / safer / harder / more race-like / explain why”

## Phase C: simplify build controls
Objective: reduce visible complexity.

Files:
- Modify: build section components and CSS
- Test: UI tests

Deliverables:
- only core controls visible by default
- “More constraints” disclosure for advanced controls
- clear helper text about what Generate does

## Phase D: review area cleanup
Objective: make review order obvious and reduce action chaos.

Files:
- Modify: review components and calendar action surfaces
- Test: UI + route tests

Deliverables:
- top review-order cards
- grouped actions by scope:
  - this week
  - this workout
  - this month
- clearer visual labels for:
  - completed
  - runtime-backed
  - draft-generated
  - user-modified

## Phase E: connect Insight and Plan
Objective: make them one product.

Files:
- Modify: `apps/web/app/app/dashboard/page.tsx`
- Modify: `apps/web/app/app/analysis/page.tsx` or insight page sources if needed
- Modify: shared server payload builders
- Test: UI tests

Deliverables:
- shared planning summary payload in both tabs
- Insight CTA into Plan using the same planning summary language
- visible “what changed” and “next key day” on both surfaces

## Phase F: automatic update loop
Objective: keep the planning workspace current without manual refreshing.

Files:
- Modify: `apps/web/app/app/_components/app-live-refresh.tsx`
- Modify: planner session freshness checks
- Modify: planning runtime reconciliation helpers
- Test: planning store + planner-data tests

Deliverables:
- update notices such as:
  - updated after today’s workout
  - tomorrow changed because freshness dropped
  - recommendation refreshed from new live snapshot
- auto-refresh and stale-state repair for plan workspace session state

---

## Functional rules to preserve

These are non-negotiable during redesign:
- live calendar day anchoring must remain primary
- exact workout structure still matters and must persist via `intervalLabel`
- blank days still default conceptually to endurance unless explicit rest
- current week must stay runtime-aware
- completed sessions never change
- locked future sessions never change
- only future unlocked sessions are editable/regenerable
- plan remains local-first until a real publish adapter is implemented

---

## UX rules to enforce

- one primary action per section
- no large cluster of mixed-scope buttons in the same visual block
- every section must answer one question:
  - Understand → what is true?
  - Decide → what should the month become?
  - Build → what constraints should shape it?
  - Review → what is the result and what should I change?
  - Publish → what gets finalized?
- every editable thing must show scope clearly:
  - this week
  - future workout
  - month-wide direction
- every auto-updated thing must show freshness/state:
  - last updated
  - changed since
  - runtime-backed

---

## What not to do

- do not turn Plan into a generic chat screen first
- do not build a full freeform chatbot before structured recommendation state exists
- do not keep adding more inline buttons to the calendar header
- do not make `/app/calendar` the main workflow destination
- do not split Insight and Plan into separate disconnected data models
- do not hide critical trust signals like last updated, current recommendation, or runtime-backed status

---

## Suggested delivery slices

### Slice 1
Planning workspace shell + state banner + Understand/Decide/Build/Review structure.

### Slice 2
Recommendation engine payload + direction-selection state.

### Slice 3
Review-area cleanup + scoped action grouping.

### Slice 4
Insight ↔ Plan shared summary integration.

### Slice 5
Automatic update / changed-since / refreshed recommendation behavior.

---

## Verification strategy

For every slice:
- update `apps/web/tests/ui-copy-and-layout.test.ts`
- add planner-data tests for any new payloads/state
- add planner-customization tests for new persisted workspace session state
- run:
  - `cd apps/web && npm test -- --test-reporter=spec tests/ui-copy-and-layout.test.ts tests/planner-data.test.ts tests/planner-customization.test.ts tests/monthly-planner-replan-route.test.ts`
  - `cd /root/.hermes/profiles/profdecisive/workspace/decisive-platform && npm run verify:web:fast`
- do one live browser check on `/app/plan`
- commit, deploy, and push

---

## Immediate next build recommendation

Build Slice 1 first.

Why:
- the product problem is currently structure and clarity more than missing logic
- a better shell will let later AI-guided recommendation features land cleanly
- it will also make it much clearer what currently works and what remains local-only

Immediate implementation order:
1. create planning workspace shell components
2. add state banner + terminology
3. split page into Understand / Decide / Build / Review sections
4. reduce visible button chaos by scope
5. verify, commit, deploy, push
