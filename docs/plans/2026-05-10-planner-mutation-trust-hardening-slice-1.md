# Planner mutation trust hardening — slice 1 implementation plan

> For Hermes: use subagent-driven-development skill if delegating later. For this slice, keep changes tight and trust-focused.

Goal: harden planner workout mutations so the reviewed client state and the applied server mutation cannot silently drift.

Architecture: extend the workout mutation contract to carry draft revision expectations in the same spirit as week preview/apply and current-week repair. Keep the month calendar client locally authoritative for fast UX, but track the latest draft revision after successful mutations so later actions are checked against the correct server state. Add regression tests at route and UI level first.

Tech stack: Next.js app router, TypeScript, node:test source assertions.

---

## Scope for this slice

Focus only on the highest-value trust gap that is still open:
1. workout mutation route has no stale-draft protection
2. month calendar client does not keep a live draft revision after successful workout/week mutations
3. stale workout actions currently fail generically instead of explicitly

Do not expand into a full workout preview/apply system yet.
Do not widen the slice into planner generation logic.

---

## Task 1: Add failing route/UI assertions for workout revision safety

Objective: lock the intended contract before implementation.

Files:
- Modify: `apps/web/tests/workout-route.test.ts`
- Modify: `apps/web/tests/ui-copy-and-layout.test.ts`

Checks to add:
- route reads `expectedDraftRevision`
- route rejects stale applies with explicit copy like `Workout mutation is stale. Refresh the planner before applying another change.`
- JSON workout mutation requests from the calendar send `expectedDraftRevision: currentDraftRevision`
- calendar stores and updates `currentDraftRevision`

Verification:
- `npm test -w apps/web -- workout-route.test.ts ui-copy-and-layout.test.ts`
- expected first: FAIL until implementation lands

## Task 2: Harden the workout route with explicit revision checks

Objective: make workout mutations revision-safe at the route layer.

Files:
- Modify: `apps/web/app/api/planner/month/workout/route.ts`

Implementation notes:
- parse `expectedDraftRevision`
- for JSON requests, require it for mutation actions
- compare it against `draft.revision || 0`
- reject stale requests with 409 and explicit error text
- include both expected/current revision in observability details
- return the updated draft revision in successful JSON responses so the client can stay aligned

Verification:
- rerun focused tests and confirm route assertions pass

## Task 3: Keep the month calendar client revision-aware

Objective: ensure successive workout/week actions use the latest draft revision rather than the initial page revision.

Files:
- Modify: `apps/web/app/app/_components/training-plan-calendar.tsx`

Implementation notes:
- initialize `currentDraftRevision` from prop `draftRevision`
- resync it when parent prop changes
- include `expectedDraftRevision: currentDraftRevision` in JSON workout requests
- after successful workout mutation, update both `weeks` and `currentDraftRevision` from the response payload
- after successful week mutation preview/apply, update `currentDraftRevision` from payload if present
- on stale 409 responses, show explicit refresh/trust copy instead of generic failure text

Verification:
- rerun focused UI tests

## Task 4: Return revision in week apply responses for client continuity

Objective: avoid leaving the client on a stale revision after successful week apply.

Files:
- Modify: `apps/web/app/api/planner/month/week/route.ts`

Implementation notes:
- include the updated draft revision in the success JSON payload after apply
- keep preview payload shape unchanged except where already returning revision

Verification:
- focused tests stay green

## Task 5: Run planner trust regression gates

Objective: verify the slice without widening scope.

Commands:
- `npm test -w apps/web -- workout-route.test.ts ui-copy-and-layout.test.ts monthly-planner-draft-route.test.ts`
- `npm run typecheck:web`
- `npm run verify:web:fast`

Expected outcome:
- route/UI trust contract covered
- stale workout actions rejected clearly
- local calendar revision stays aligned after successive mutations

## Commit shape
- `fix: harden planner workout mutation revision safety`

## Why this slice first
This is the cleanest next trust step because it closes a real coherence gap without redesigning the planner surface. It protects exact intended structure from silent stale writes, which matters more right now than adding another planner feature.