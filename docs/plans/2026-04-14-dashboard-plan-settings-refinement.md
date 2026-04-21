# Dashboard / Training Plan / Settings Refinement Plan

> For Hermes: use test-driven-development for each code change, keep user-scoped data authoritative, and verify with targeted tests plus full web build.

Goal: refine decisive.coach dashboard, training plan, and configuration UX so the dashboard reflects the current logged-in athlete cleanly, planning blocks become more useful, and settings are available to athletes while admin-only management stays separated.

Architecture: keep the embedded coach dashboard served by the local Python service, but make it consume user-scoped snapshot/customization data where needed. Keep the Next.js planner/training-plan surfaces for structured planning UI. Split configuration concerns between athlete-facing configuration and admin-only user-management sections.

Tech stack: Next.js app router, local Python dashboard service, JSON-backed platform/customization stores, node:test/tsx tests, unittest for Python dashboard behavior.

Tasks:
1. Inspect current dashboard/training-plan/settings render paths and data sources.
2. Add failing tests for requested copy/layout and user-scoped dashboard calculations.
3. Implement user-scoped dashboard data fixes and wording changes.
4. Implement training-plan layout/content changes.
5. Implement configuration/settings navigation and admin subtab separation.
6. Run tests, typecheck, build, and restart services.
