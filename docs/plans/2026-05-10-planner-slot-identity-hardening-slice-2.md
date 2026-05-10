# Planner slot identity hardening — slice 2

Goal: prevent regenerated weeks from reusing one existing planner slot across multiple structurally similar workouts.

Why this slice mattered
- exact intended structure becomes unsafe if duplicate same-day/same-family sessions collapse onto one prior slot
- that can silently move lock state, source, and reconciliation metadata onto the wrong planned session
- this is especially relevant for stacked race-like or support sessions on the same day

What changed
- hardened `apps/web/lib/server/monthly-plan-persistence.ts`
- matching now tracks already-consumed existing slot identities while rebuilding a stored week
- structural matching still works, but an existing slot can only be claimed once during regeneration
- completed and planned workout matching both now avoid duplicate reuse of the same prior slot

Regression coverage
- preserved reordered structural matches without losing slot identity
- added duplicate-structure regression proving two regenerated same-shape sessions keep two distinct plannerSlotIds
- preserved user-modified metadata on the reused matching slot

Verification
- `npm test -w apps/web -- planner-customization.test.ts`
- then broader planner/web verification before commit

Next best trust slice
- carry the same slot-identity uniqueness expectations through additional regenerate/replan pathways and any route-level payloads that still assume one structural match is enough.