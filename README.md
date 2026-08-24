# Tide PWA V7.7

Progress and Goal Review refinements.

- Progress shows Weight, Target, and one thin pink Forecast trajectory.
- The visible 7-day-average line and tooltip value are removed.
- Internally, a calendar-based 7-day smoothing is still used to estimate the current trend and recent pace.
- The pink trajectory is back-traced to the Goal start weight, joins the current smoothed state, then projects forward with a gradually damped pace.
- A vertical guide line aligns selected weight points with the date axis.
- Forecast summary cards are more compact.
- Goal Review is two-step: paste JSON and Preview Review first; history stays visible; only final Save Review commits the checkpoint and returns to Goals.
- Active Goals continue to show the latest Learning and Next action directly on the Goals page.
- Same `tide.v1` local data store; no reset.
