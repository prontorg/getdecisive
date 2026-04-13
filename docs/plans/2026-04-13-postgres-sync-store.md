# Postgres sync-store implementation plan

> For Hermes: execute incrementally with TDD. Prioritize moving sync jobs and user-scoped snapshots out of the shared JSON store first.

Goal: remove the highest-risk shared-writer path by storing sync jobs and intervals snapshots in Postgres, while allowing auth and broader platform state to remain on the file-backed dev store temporarily.

Architecture:
- Keep current file-backed auth/user/onboarding state for now.
- Introduce a small server-side sync store abstraction with two backends:
  - file fallback for current local/dev safety
  - Postgres backend when DATABASE_URL is configured
- Move worker and onboarding/sync routes to use the sync store abstraction for sync jobs and snapshots.

Initial task slices:
1. Add SQL schema draft for sync jobs + intervals snapshots.
2. Add minimal Postgres client/helper in apps/web.
3. Add sync store abstraction with file fallback and Postgres backend.
4. Wire onboarding intervals-connect route to persist/read sync jobs via sync store.
5. Wire worker to use sync store instead of raw JSON for sync jobs and snapshots when Postgres is configured.
6. Add tests for backend selection and file fallback behavior.
7. Keep current runtime honest: Postgres path optional until DATABASE_URL is configured.
