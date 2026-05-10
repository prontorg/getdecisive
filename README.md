# Decisive Platform

Multi-user training planner platform for decisive.coach.

Important product/deployment direction:
- this platform is separate from the current legacy dashboard deployment
- the planner/product app should remain its own surface
- current work is focused on making the planner trustworthy, operational, and multi-user ready

## Current scope
- apps/web: Next.js product shell and planner UI
- apps/worker: background sync/worker runtime
- services/coaching-engine: coaching/sync/planning domain package boundary
- packages/types: shared TypeScript types
- packages/config: shared TypeScript config helpers
- docs/architecture: architecture/documentation index
- docs/plans: roadmap, status, and implementation notes
- db/schema: PostgreSQL schema drafts

## Current status
This is no longer just an initial scaffold.

Best current read:
- planning core: largely implemented
- advanced planner interactions: substantially underway
- workout/export layer: next major product expansion
- worker/integration layer: present, but less documented than the planner surface

What is already real:
- auth/invite/onboarding shell
- admin/user management surface
- Intervals connection + sync status flows
- monthly planner builder
- recommendation-driven month direction
- month draft generation/review
- current-week runtime overlay
- planned-vs-done reconciliation/truth surface
- drag/drop and week/session mutation flows
- local publish semantics

## Canonical current roadmap/status note
Use this as the current source of truth:
- `docs/plans/2026-05-01-platform-health-and-roadmap-status.md`

That note supersedes older scaffold framing and summarizes:
- platform health
- roadmap position
- main risks
- next three highest-value slices

## Highest-value next slices
1. roadmap/docs consolidation
2. planner mutation trust hardening
3. workout/export operational layer

## Release discipline
- Never deploy the planner app without running automated regression checks first.
- Standard fast verification command: `npm run verify:web:fast`
- Standard verification command: `npm run verify:web`
- Standard release command: `npm run release:web`
- `verify:web:fast` runs the fastest high-value gate: placeholder/TODO audit, typecheck, and focused reliability regressions.
- `verify:web` runs the full web + worker quality gate.
- `release:web` runs the full quality gate, restarts services, then verifies both local and public smoke checks before succeeding.
