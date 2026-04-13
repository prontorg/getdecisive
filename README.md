# Decisive Platform

Multi-user training planner platform scaffold for decisive.coach.

Important deployment decision:
- this planner/product app is separate from the current dashboard site
- recommended host: `app.decisive.coach`
- keep the current dashboard deployment untouched while this platform is built

Current scope:
- apps/web: Next.js product shell
- apps/worker: Python background job runner scaffold
- services/coaching-engine: Python coaching/sync domain package scaffold
- packages/types: shared TypeScript types
- packages/config: shared TypeScript config helpers
- docs/architecture: product and architecture documents
- db/schema: initial PostgreSQL schema drafts

## Status
This is the initial Milestone A scaffold:
- monorepo structure
- separate-site auth/invite/onboarding skeleton
- database schema draft
- worker/coaching-engine boundaries

## Suggested next steps
1. Install web dependencies in `apps/web`
2. Set up PostgreSQL and migrations
3. Implement auth and invite code flows
4. Implement guided Intervals onboarding + sync status UI
5. Connect worker to coaching-engine sync modules
