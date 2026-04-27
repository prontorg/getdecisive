# Max weekly hours guidance note

Intent:
- the Hours input is a hard weekly ceiling, not a target to fill at all costs
- month planning should still follow sound progression and block logic underneath that ceiling

Required planner behavior:
- treat `maxWeeklyHours` as the maximum allowed weekly budget
- still determine week focus and progression from training needs, freshness, event pressure, and phase logic
- allow planned weeks to come in below the cap when best-practice progression calls for it
- protect lighter weeks and freshness-constrained weeks instead of inflating them toward the cap
- current week must respect remaining available hours after completed work and planner events
- review copy should describe the cap as a ceiling, not as a promise to hit the number every week

Practical product wording:
- rename the mental model to `maximum hours / week`
- coach logic: `use the cap as an upper bound, not a filler target`

Next implementation check:
- add regression coverage that a lower cap constrains the month while week-to-week progression still remains sensible and non-flat
- add/source-check wording that the builder hours field is understood as a maximum, not a mandatory target
