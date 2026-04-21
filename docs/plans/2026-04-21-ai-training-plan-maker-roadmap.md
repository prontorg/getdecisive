# AI Training Plan Maker Roadmap

> For Hermes: use this as the working specification and implementation roadmap for the next decisive-platform planning-engine phase.

Created: 2026-04-21 19:29 UTC

Goal
Build a fully AI-supported training plan maker for cycling that produces meaningful, coach-grade training plans while keeping the user experience simple, smooth, and low-friction.

Product principles
- Planning quality first: the planner must produce meaningful cycling training, not just neat calendar structure.
- Smooth UX is a core requirement, not polish added later.
- The system should feel coach-like, constrained, and trustworthy — not random or overly chatty.
- Exact workout structure matters for planning, execution, and later comparison.
- Keep visible controls minimal; complexity belongs in the engine, not the default UI.
- AI should reason inside guardrails, not free-write arbitrary plans.

What “good” means
The planner should:
- diagnose athlete needs across multiple systems, not just a few broad categories
- choose the right block objective for the current context
- build coherent weeks with realistic density and progression
- prescribe workouts with purpose, not just labels
- adapt based on execution, fatigue, and event proximity
- explain why the plan exists in concise coach language
- remain easy to use through a compact control surface

Required system layers

1. Athlete model
The system needs stable athlete state including:
- event goals and priorities
- discipline focus (track endurance primary, road support secondary)
- strengths and weaknesses
- response patterns to training density and session types
- time constraints and preferences
- event calendar and availability constraints

2. Performance-system model
The system must reason over a richer system map than the current planner. Core systems should include at least:
- neuromuscular / sprint
- anaerobic capacity
- short VO2
- long VO2 / MAP support
- repeatability
- threshold / MLSS support
- tempo / sweet spot
- aerobic durability
- recovery capacity
- event-specific race demands

3. Training-state diagnosis engine
The planner must infer:
- what is improving
- what is stale
- what is overloaded
- what is underdosed
- what is blocked by fatigue
- what is blocked by insufficient support

Use inputs such as:
- recent workout structure labels
- training load distribution
- time in zone
- power-duration and best-effort signals where available
- density and spacing of hard sessions
- completed vs planned work
- event proximity
- subjective readiness/check-ins

4. Planning engine across horizons
The engine should operate coherently at:
- macro level: season / event sequencing
- meso level: block objectives and progression
- weekly level: hard-day count, spacing, long ride role, support/recovery logic
- daily level: planned today, should-do today, tomorrow if today lands

5. Workout generation engine
The system should choose real workout types, not only categories. It needs a structured session library by category and intent, for example:
- threshold: sustained, over-under, race-support threshold
- VO2: short, long, broken
- repeatability: 30/15, 40/20, 2'/1', attack/recover
- race-like: stochastic, surge-settle, finish-under-fatigue
- endurance: long aerobic, support endurance, recovery endurance
- strength/cadence/torque support variants

6. Adaptation loop
The planner must learn from execution:
- completed vs missed
- structure compliance
- power/HR/RPE response if available
- success/failure patterns
- fatigue accumulation
- freshness after unload
- response to density and session type

7. Trust / explainability layer
The system must explain, compactly:
- why this month
- why this week
- why this session
- what changed because of fatigue or execution
- what was planned today vs what should actually happen today

AI vs deterministic responsibilities

AI should do:
- infer limiter systems
- summarize training state
- prioritize needs
- choose among plausible block directions
- explain tradeoffs and adaptations

Deterministic logic should do:
- enforce spacing rules
- cap weekly hours and impossible combinations
- respect taper and event constraints
- reject unsafe density and unrealistic load jumps
- preserve internal consistency of the plan

UX requirements
The planner UX should remain simple even as intelligence increases.

Default visible UX should stay compact:
- selected direction
- hours cap
- rest-day / key constraint controls
- one clear generate/update action
- one main calendar review surface

Important UX rules
- Avoid turning the planner into a long wizard or text-heavy consultation flow.
- Keep the main interaction model “choose, tune, review”.
- Explanation should be available, but secondary to the plan itself.
- The calendar should remain the dominant review/edit surface.
- Hide advanced controls and low-frequency actions behind compact disclosure patterns.
- Keep language concise and coach-like.
- Make recommendations feel trustworthy before they feel clever.

Current gaps in decisive-platform
The current planner is still mainly:
- rule-based
- category-slot driven
- based on a narrow set of systems
- not yet selecting from a rich workout library
- not yet using a robust needs/diagnosis model

That means it can produce a structured month, but not yet a meaningfully individualized cycling plan.

Recommended implementation roadmap

Phase 1: Training-needs engine v1
Objective
Create a better diagnosis layer before generation.

Deliverables
- training-needs summary object in planner-data.ts
- richer system-status inference
- freshness-state and event-pressure inference
- tests for needs detection from recent live data

Suggested outputs
- repeatability_status
- threshold_support_status
- race_specificity_status
- aerobic_durability_status
- anaerobic_status
- freshness_state
- density_tolerance
- event_pressure
- primary_limiters
- protected_strengths

Phase 2: Block-decision engine v1
Objective
Turn diagnosis into meaningful 4-week intent decisions.

Deliverables
- month objective decision logic
- week-intent selection logic
- progression / unload logic tied to diagnosis and event pressure
- tests for week-intent selection under multiple athlete states

Examples
- threshold consolidate
- repeatability build
- race-specific bridge
- absorb / freshen
- taper-openers

Phase 3: Workout library + session selection v1
Objective
Replace broad labels with real session prescriptions.

Deliverables
- structured workout library in a dedicated module
- mapping from training needs + week intent -> workout selection
- progression rules within session families
- intervalLabel and rationale generation tied to selected session archetype
- tests covering workout choice logic

Phase 4: Weekly realism and validation layer
Objective
Reject bad plans and force coherence.

Deliverables
- density validation
- load-jump validation
- support-to-quality balance checks
- event-week realism checks
- current-week remaining-time checks
- tests for unsafe-plan rejection and safer fallback generation

Phase 5: Adaptation loop v1
Objective
Make the plan respond meaningfully to execution.

Deliverables
- post-workout assessment inputs
- weekly update logic from completed/missed/failed work
- athlete-response notes or learned patterns store
- replanning that changes future work more intelligently than simple scenario transforms

Recommended file/module direction

Likely additions
- apps/web/lib/server/planner-data.ts
  - keep as the orchestration layer initially
- apps/web/lib/server/planning/training-needs.ts
  - diagnosis engine
- apps/web/lib/server/planning/block-decisions.ts
  - block/week intent engine
- apps/web/lib/server/planning/workout-library.ts
  - structured session archetypes
- apps/web/lib/server/planning/workout-selection.ts
  - choose workout from needs + week intent
- apps/web/lib/server/planning/plan-validation.ts
  - realism checks and fallback rules
- apps/web/tests/planner-data.test.ts
- new focused tests for needs/block/workout selection modules

Near-term delivery sequence

Step 1
Add a training-needs summary module and tests.

Step 2
Refactor buildMonthlyPlannerDraftPayload(...) so it consumes training-needs outputs rather than directly using raw recent-session counts and hardOne/hardTwo logic.

Step 3
Add week-intent decision logic based on training needs, freshness, and event pressure.

Step 4
Replace generic hard-session selection with a small but real workout library.

Step 5
Keep the current UX surface largely intact while improving the engine underneath.

Shipping guidance
The right next slice is not more UI polish.
The right next slice is:
- training-needs engine + block-decision engine v1

Definition of success for that slice
- the planner reasons over more than the current narrow categories
- week intents vary meaningfully with training state and event proximity
- workouts are selected from purposeful session archetypes
- the resulting plan looks more like something a strong cycling coach would actually prescribe
- the visible UX remains compact and calm

Open design constraints to preserve
- blank calendar days default conceptually to endurance unless otherwise constrained
- exact workout structure remains important
- freshness management remains central
- repeatability, race-specificity, and threshold support stay important, but they are not the full system map
- visible planner UX should stay simple and low-click

Next concrete implementation task
Implement Phase 1 and Phase 2 first:
- training-needs engine v1
- block-decision engine v1

This is the next active roadmap item for decisive-platform.