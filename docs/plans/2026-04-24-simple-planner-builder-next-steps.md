# Simple Planner Builder — Next Steps

Goal: make the planner builder actually work while reducing visible complexity, not increasing it.

Principle:
- one compact builder row
- one obvious primary action
- advanced options hidden by default
- no new visible controls unless they remove confusion or fix a broken flow

## What stays visible
Only these controls should stay in the default builder surface:
- direction chips
- weekly hours
- rest day
- one Generate plan button

Everything else stays under `More options` or becomes inferred.

## Current problem
The planner engine is progressing, but the builder still behaves like a thin form shim:
- several parameters are technically wired but not truly editable or trustworthy
- the user cannot clearly tell what is active right now
- the generated draft does not yet feel tightly bound to the selected simple builder state

## Next building blocks

### 1. Make the simple surface trustworthy
Keep the visible controls minimal, but make them fully reliable:
- selected direction must always be the one that gets submitted
- weekly hours and rest day must always survive chip changes and reloads
- the compact summary line should always reflect the real active advanced constraints

### 2. Keep advanced options hidden, but make them real
Do not add more top-level controls.
Instead, fix the hidden advanced section so the existing extra settings are actually usable and persisted:
- weekday cap
- blocked dates
- data filters
- no doubles / hard spacing
- note / success markers

### 3. Add one compact saved-state / dirty-state signal
Do not add more buttons.
Add only a small status signal near the builder, for example:
- `Saved`
- `Unsaved changes`
- `Draft updated`

This should make the build loop understandable without clutter.

### 4. Make review clearly reflect the last build
After generating, the review section should clearly match the current builder state:
- selected direction
- hour cap
- rest day
- active advanced constraints summary

Not as more cards; just as one compact `Built from` line.

### 5. Harden parity across all planner mutations
When workouts/weeks are changed later, the planner should not drift from the current month inputs.
Check parity for:
- generate month
- regenerate week
- move workout
- publish
- page reload

## Recommended execution order
1. Simplify the builder model around the existing compact row
2. Fix hidden advanced options so they are real but not noisy
3. Add compact saved/unsaved + built-from signals
4. Harden reload and mutation parity
5. Run live browser QA and remove anything that still feels noisy

## Anti-goals
Do not do these next:
- add more visible parameters
- add more visible buttons
- add another wizard step
- add another explanation panel
- add more recommendation chrome before the simple builder loop is trustworthy

## Definition of better
The planner is better when:
- the default visible builder is smaller
- the selected direction is obvious
- one click builds the draft
- the draft clearly reflects that build
- advanced settings exist but stay out of the way
