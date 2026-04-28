# Planner fix roadmap and week-preview next slice

> For Hermes: keep planner work anchored to track-endurance trust, exact structure visibility, and explicit planned-vs-done truth. Do not let page renders silently mutate persisted drafts.

Date: 2026-04-28

## Why this note exists
The planner is now useful enough that the main risk is no longer missing features first. The main risk is trust erosion from hidden regeneration, weak persistence identity, and apply flows that are not tightly bound to the preview the athlete just inspected.

This note records the highest-value fixes in order, plus the next implementation slice.

## Core diagnosis
The planner currently does many good things:
- recommendation-driven month generation
- current-week repair previews
- planned-vs-done truth summary
- drag/drop and reconciliation actions
- local publish semantics

But the planner still has four structural problems:
1. viewing the plan can mutate the persisted draft
2. workout/week identity is still fragile across regeneration
3. preview and apply are not fully tied to the same exact proposal artifact
4. week-level mutations are still too blunt and not guardrail-aware enough

These are higher-priority than adding more planner intelligence.

## Highest-value findings

### 1. Silent draft regeneration on page render is the biggest trust break
Files:
- `apps/web/app/app/_components/training-plan-page.tsx`

Current issue:
- `/app/plan` checks whether the draft is stale and, if so, immediately rebuilds and saves a new draft during page render.
- This means opening the page can change persistent planner state without explicit user action.
- It also means manual adjustments, week repairs, or published-future state can appear to drift “by themselves.”

Fix direction:
- remove persistence writes from page render entirely
- replace with explicit stale detection and a visible refresh CTA
- show draft provenance:
  - draft built at
  - live snapshot date
  - latest input id
  - stale vs current status

### 2. Persistence still maps workouts by array position
Files:
- `apps/web/lib/server/monthly-plan-persistence.ts`

Current issue:
- generated workouts are reconciled back into stored workouts using `existing?.workouts[index]`
- if generation or replanning reorders, inserts, or drops sessions, existing metadata can attach to the wrong workout
- this affects:
  - lock state
  - reconciliation status
  - matched planned workout ids
  - completed labels

Fix direction:
- introduce a stable planner slot id
- persist and merge by slot identity, not array index
- use index matching only as migration fallback

Suggested contract:
- `plannerSlotId`
- `weekIndex`
- `slotRole` such as:
  - `support_primary`
  - `quality_primary`
  - `support_secondary`
  - `quality_secondary`
  - `long_endurance`
  - `rest_primary`
  - `rest_secondary`

### 3. Current-week preview/apply is better, but still not exact enough
Files:
- `apps/web/app/app/_components/current-week-repair-panel-client.tsx`
- `apps/web/app/api/planner/month/replan/route.ts`

Current issue:
- preview shows exact changes
- apply recomputes from live state and draft state at apply time
- the user is not applying the exact preview object they just reviewed
- if anything changes between preview and apply, the applied result may differ from the preview

Fix direction:
- make preview return a deterministic preview artifact:
  - `previewId` or `previewHash`
  - `draftRevision`
  - `liveSnapshotDate`
  - exact proposed week patch
- require apply to submit that artifact
- reject apply when the preview is stale
- show `Preview is stale — refresh first` instead of silently applying something different

### 4. Current-week replan still relies on full-week replacement
Files:
- `apps/web/lib/server/planner-data.ts`
- `apps/web/app/api/planner/month/replan/route.ts`

Current issue:
- replanning currently rewrites the remaining week and then replaces the stored week
- preservation of completed / locked / manually edited state is not robust enough because it depends on positional mapping

Fix direction:
- split current week into three layers:
  - immutable truth: completed and past sessions
  - protected future: locked sessions
  - editable future: replannable sessions
- replan only the editable segment
- merge with an explicit invariant-preserving function before save

### 5. Week mutation actions are too blunt
Files:
- `apps/web/app/api/planner/month/week/route.ts`

Current issue:
- `reduce_load`, `increase_specificity`, and `lighter_weekend` use direct transformation logic
- `regenerate` replaces the week from a fresh month generation output
- there is no exact diff preview and no full scheduling revalidation before apply
- `increase_specificity` simply converts the first eligible session it finds

Fix direction:
- move week actions onto the same preview-before-apply model as current-week repair
- generate exact slot diffs and consequence summaries before apply
- validate against:
  - back-to-back hard-day guardrail
  - blocked dates
  - weekday time cap
  - event hours
  - rest-day preservation
  - quality density

### 6. Scheduling validation is fragmented
Files:
- `apps/web/app/api/planner/month/workout/route.ts`
- `apps/web/app/api/planner/month/week/route.ts`
- `apps/web/lib/server/planner-data.ts`

Current issue:
- generation, move-day, current-week replan, and week action logic each apply constraints differently
- move-day conflict checks only cover same-day and adjacent-hard conflicts
- other builder inputs such as unavailable dates and weekday caps are not enforced uniformly across mutation paths

Fix direction:
- create one shared scheduling validator used by:
  - month generation
  - week action preview/apply
  - current-week preview/apply
  - move-day
- centralize rule outputs as machine-readable reasons

### 7. Some builder parameters are visible before they are fully enforceable
Files:
- `apps/web/lib/server/planner-customization.ts`
- `apps/web/lib/server/planner-data.ts`
- plan builder UI files

Current issue:
- some inputs are persisted but not clearly enforced end-to-end
- that creates expectation debt

Fix direction:
- classify every parameter as:
  - enforced
  - advisory
  - future
- do not show “future” in the main builder unless clearly labeled
- add regression tests proving that each visible enforced parameter changes the planner output or validation

### 8. Track-endurance specificity is still too label-driven
Files:
- `apps/web/lib/server/planner-data.ts`

Current issue:
- specificity upgrades still rely too much on broad category swaps and hardcoded labels
- that is not precise enough for repeatability, track-endurance structure, and later planned-vs-done comparison

Fix direction:
- formalize workout family taxonomy with ids and demand tags
- use structured family selection instead of label rewrites

Suggested fields:
- `familyId`
- `familyIntent`
- `demandTags`
- `freshnessCost`
- `phaseCompatibility`
- `raceUseCase`
- `selectionRationale`

## Ordered fix roadmap

### Priority 1 — stop hidden state changes
1. remove silent draft save from `/app/plan` render
2. add draft freshness/provenance panel
3. add explicit `refresh draft from live` action

### Priority 2 — make mutation identity safe
1. add `draftRevision`
2. add `plannerSlotId`
3. stop relying on array index in persistence mapping
4. reject stale mutation writes

### Priority 3 — unify preview-before-apply
1. current-week preview artifact with stale protection
2. week-action preview endpoint and client surface
3. shared exact diff shape for all planner mutations

### Priority 4 — centralize scheduling integrity
1. shared scheduling validator
2. move-day uses full validator
3. week actions use full validator
4. current-week repair uses full validator

### Priority 5 — deepen track-endurance contract
1. structured workout-family taxonomy
2. structured specificity shifts
3. family-based comparison in truth/review surfaces

## Next intended implementation slice

### Week action preview/apply trust model
Goal:
- apply the same inspect-before-apply discipline to week-level actions that current-week repair now has

Target outcomes:
- week actions show exact before/after slots before apply
- each action shows:
  - hours/load consequence
  - key-session protection summary
  - freshness risk note
  - blocked or adjusted slots when constraints intervene
- apply is bound to the exact preview artifact the user saw

Files likely involved:
- `apps/web/app/api/planner/month/week/route.ts`
- `apps/web/app/app/_components/training-plan-calendar.tsx`
- `apps/web/app/app/_components/training-plan-page.tsx`
- `apps/web/lib/server/planner-data.ts`
- likely new helper modules once planner-data starts splitting
- tests in:
  - `apps/web/tests/planner-data.test.ts`
  - `apps/web/tests/ui-copy-and-layout.test.ts`
  - new week-route focused test if needed

## Working rule
If there is a conflict between adding more mutation options and making existing planner changes safer, choose safety first. For Tobias, the planner must feel exact, inspectable, and stable before it becomes broader.
