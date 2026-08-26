# Tide PWA V8.1

Behavior tracking added to the existing Goal experience without redesigning Tide.

- Keeps Weight prominent; Goals now also shows current weight and 7-day average.
- Adds per-goal tracker roles: **Goal / Bonus / Track only**.
- Adds compact 1×7 weekly behavior grids for Goal-role trackers only.
- Daily Goal trackers show done / missed / today / future / N/A; weekly Goal trackers never treat a non-contributing day as a failure.
- Adds Protein and Bedtime hunger; Bedtime hunger is a 1–5 observation by default.
- Adds Skip / N/A per tracker and excludes it from adherence calculations.
- Goal setup has Focus (Diet / Exercise / Both / Other) as a role-prefill convenience, not a separate data model.
- Bonus and Track-only summaries stay lightweight.
- Weekly Review is role-aware: only Goal items can be execution gaps; Bonus is positive-only; Track only and Weight provide context.
- ChatGPT Goal Review export now requires the exact `goalId / preview / review{summary,learnings,next}` schema and rejects extra fields.
- Progress x-axis date labels are evenly spaced and anchored inside the chart bounds.
- Existing `tide.v1` data is migrated in place; legacy fields and prior reviews remain compatible.
