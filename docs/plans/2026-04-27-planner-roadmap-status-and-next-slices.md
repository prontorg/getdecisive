# Decisive planner roadmap status and next slices

Date: 2026-04-27

## Why this note exists
Persist the current planner direction in-repo so implementation does not drift and future work stays anchored to the original roadmap.

## Original roadmap reference
Planner work was originally framed as:
- Milestone C: planning core
- Milestone D: advanced plan interactions
- Milestone E: workouts + coach layer

## Current position
We are no longer at planner start-up stage.
Current position is:
- Milestone C: largely implemented
- Milestone D: actively being completed
- Milestone E: still mostly ahead

## What is already real
### Planning core largely implemented
- structured monthly builder
- recommendation-driven month direction selection
- month draft generation
- embedded month calendar review surface
- compare vs recent 4 weeks
- current-week runtime overlay
- local publish state
- race/event planning inputs
- block/needs/workout-family planner intelligence

### Milestone D pieces already in place
- move-day mutation with conflict detection and safer-day suggestion
- week mutation routes
- current-week replan route
- drag/drop-capable calendar interaction shell
- lock/unlock
- easier/harder/remove session mutations

## What was completed in this work block
### Slice 1 — explicit reconciliation states
Added planner session states for:
- skipped
- replaced
- completed_modified

Also added reconciliation notes so planned-vs-done is not reduced to only planned/completed.

### Slice 2 — mutation UX cleanup
Added:
- faster reconciliation actions on session cards
- clearer visual status treatment
- current-week repair panel with one-click replan actions

### Slice 3 — persistence/contract hardening
Added a shared persistence mapper so these paths use the same stored week/workout contract:
- draft generation
- automatic draft refresh
- week regeneration
- current-week replan

This reduces metadata drift across save paths.

## Current planner priorities
The highest-value work now is not more intelligence first.
The highest-value work is completing Milestone D cleanly.

Priority order:
1. preserve one stable planner persistence contract
2. make planned-vs-done truth explicit and user-visible
3. finish current-week repair/reconciliation loop
4. only then expand publish semantics and workouts/export layer

## Next intended slices
### Slice 4 — deeper planned-vs-done truth model
Goal:
- make reconciliation/history clearer than per-card status alone

Target outcomes:
- compact reconciliation/event log
- clearer explanation of what was planned, what actually happened, and what was replaced/skipped
- stronger bridge between block intent and actual execution

### Slice 5 — publish semantics hardening
Goal:
- keep local-first safety but make publish state clearer and more robust

Target outcomes:
- explicit future-only publish semantics
- better distinction between draft, locally published, and externally synced states

### Slice 6 — workouts/export layer
Goal:
- start Milestone E with a clearer canonical workout/export surface

## Guardrails
- completed slices should be committed promptly
- planner direction should be persisted in docs/plans
- planner work should continue to prioritize Tobias-specific track-endurance requirements:
  - repeatability
  - race specificity
  - threshold support
  - freshness management
  - exact workout structure visibility

## Working rule
If implementation detail and roadmap direction conflict, choose the direction that keeps the month planner coherent, current-week truthful, and future work extensible.