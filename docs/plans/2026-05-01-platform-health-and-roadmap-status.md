# Decisive platform health and roadmap status

Date: 2026-05-01

## Why this note exists
The platform has moved far beyond the original scaffold framing, especially in the planner. This note creates one current source of truth for:
- platform health
- roadmap status
- the next three highest-value slices

## Executive summary
Overall status:
- web app health: good
- planner product health: strong and usable
- integration/worker health: acceptable but less mature and less documented
- roadmap documentation health: mixed, with clear drift between top-level docs and actual implementation state

Main conclusion:
The core problem is no longer lack of planner features. The main problem now is making the platform feel exact, trustworthy, coherent, and operationally ready.

## Current health assessment

### 1. Web app health
Strong.

Verified state at assessment time:
- `apps/web` tests passing
- `apps/web` typecheck passing
- `apps/web` production build passing
- recent commit history shows active iteration and successful planner UX/trust fixes

Signals of health:
- the product shell is real, not scaffold-only
- auth/onboarding/admin/planner routes all exist
- planner interaction surface is actively maintained
- recent work has focused on regression fixing and trust polish, which is a good sign of product maturity

### 2. Planner health
Stronger than the repo root docs currently suggest.

What is already real:
- monthly planner builder
- recommendation-driven month direction
- month draft generation and review
- compare vs recent 4 weeks
- current-week runtime overlay
- local publish semantics
- race/event inputs
- drag/drop calendar interactions
- week and session mutation routes
- current-week repair flows
- planned-vs-done truth and reconciliation surface

Interpretation:
- planner core is largely implemented
- advanced interactions are partly implemented and being refined
- planner trust/safety work is now more important than adding broad new intelligence

### 3. Worker/integration health
Acceptable, but less proven than the web layer.

Observations:
- worker responsibilities are clearly intended
- coaching-engine boundaries are named
- shared snapshot/sync concepts exist in the codebase and tests
- but the docs/readmes around worker and service layers are thin compared with the planner surface

Interpretation:
- integration architecture exists
- operational/documentation maturity trails product-surface maturity

### 4. Documentation health
Mixed.

Healthy:
- many planner-specific notes exist in `docs/plans/`
- they preserve important decision history

Unhealthy:
- `README.md` still frames the platform as an initial Milestone A scaffold
- `docs/architecture/README.md` points to missing files:
  - `2026-04-12-decisive-platform-blueprint.md`
  - `2026-04-12-decisive-platform-technical-spec.md`
  - `2026-04-12-decisive-platform-implementation-plan.md`
- roadmap direction is spread across several notes instead of one canonical current status doc

Interpretation:
- implementation has outrun repo-level documentation
- this is now a real coordination risk

## Roadmap status

## Original framing
Historically the planner work was framed as:
- Milestone C: planning core
- Milestone D: advanced plan interactions
- Milestone E: workouts + coach layer

## Real current position
Best current read:
- Milestone C: largely complete
- Milestone D: substantially underway, with trust/safety cleanup still important
- Milestone E: still ahead, but now the most logical next major product expansion

## What is effectively complete enough
- planner is no longer a concept demo
- planning core works end-to-end
- user can generate, inspect, compare, adjust, and reconcile a month draft
- current-week truth model exists

## What is still the active bottleneck
Not more planner intelligence first.

Current bottlenecks are:
1. trust and exactness of planner mutations
2. coherence of the planner surface
3. operational bridge from plan -> workout/export/use
4. consolidation of roadmap/docs

## Core strategic rule
If forced to choose between:
- more mutation options / more “smartness”
- or safer, clearer, more exact planner behavior

choose planner trust first.

For this product, trust in exact structure and planned-vs-done truth matters more than another layer of sophistication.

## Main risks

### Risk 1: roadmap drift
Because top-level docs understate maturity while planner notes show substantial progress, future work could be prioritized from the wrong baseline.

### Risk 2: trust erosion in planner behavior
The planner is useful enough that hidden state changes, fragile identity, or preview/apply mismatch now hurt more than missing features.

### Risk 3: product stalls before operational bridge
The planner can already think and review. If workout/export and operational use stay too far behind, product value will flatten.

### Risk 4: worker/integration knowledge stays too implicit
The web layer is easier to assess than the integration layer. That imbalance becomes riskier as the platform gets more production-like.

## Next three highest-value slices

### Slice 1 — roadmap and documentation consolidation
Goal:
- bring repo truth in line with actual platform state

Why this is first:
- reduces implementation drift
- gives future work a clean starting point
- prevents stale scaffold framing from distorting decisions

Target outcomes:
- top-level README reflects real current state
- architecture index stops pointing to missing files
- one canonical current roadmap/status note links out to older historical notes

Likely scope:
- update `README.md`
- repair `docs/architecture/README.md`
- keep this note as the canonical current status anchor

### Slice 2 — planner mutation trust hardening
Goal:
- make planner mutations exact, inspectable, and revision-safe everywhere

Why this is second:
- planner value is already high enough that trust is the main product risk
- this strengthens the product more than adding more planner cleverness right now

Target outcomes:
- stable slot identity everywhere
- stale preview/apply rejection everywhere needed
- uniform mutation safety/validator behavior
- clearer provenance/revision handling in planner state

Likely scope:
- planner slot/revision contract hardening
- preview/apply exactness improvements
- shared validation path for move/week/current-week actions

### Slice 3 — workout/export layer
Goal:
- make the planner operational, not only analytical

Why this is third:
- it is the cleanest next product expansion after planner trust work
- it converts planning value into athlete-use value
- it aligns with Tobias’s emphasis on exact workout structure

Target outcomes:
- clearer canonical workout representation
- practical export surface
- stronger bridge from month plan -> actual executable sessions

Likely scope:
- workout/export UX and contract
- structure-first workout rendering
- cleaner distinction between planner draft, workout object, and export artifact

## Working rule for future work
Use this order when deciding what to do next:
1. keep planner truth coherent
2. keep planner mutations safe and exact
3. make the platform more operational
4. only then broaden intelligence/surface area further

## Short verdict
The platform is in better shape than the root docs say.
The planner is already meaningful product, not scaffolding.
The highest-value next work is:
- documentation consolidation
- planner trust hardening
- workout/export operationalization
