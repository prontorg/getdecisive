# Admin user management and user-scoped dashboard implementation plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task.

Goal: add admin user CRUD with editable Intervals settings, persist those users/settings, and ensure each login sees only that athlete’s synced dashboard/planner data. Also add directional arrow icons to the training-plan system trend rows.

Architecture: extend the existing auth-store/platform-state layer with explicit admin-managed user CRUD and Intervals upsert/delete helpers, then expose them through admin-only POST routes and a richer Settings page. Keep user scoping anchored to existing userId + externalAthleteId snapshot ownership so each account resolves only its own ready connection/snapshot. Trend arrows stay as a thin UI enhancement in the training-plan component.

Tech stack: Next.js app router, file-fallback + Postgres dual store, existing auth-store/platform-state sync pipeline, Node test runner.

---

Task slices:
1. Inspect and extend persistence layer types/helpers for admin-managed users and connection updates/removal.
2. Add admin-only route handlers for create/update/delete user and user-specific Intervals config save/delete.
3. Expand Settings UI with user list + create/edit forms.
4. Add trend arrow icon rendering in training-plan system trend rows.
5. Add regression tests for CRUD, per-user data scoping, and trend UI.
6. Verify with targeted tests, typecheck, build, and service restarts.
