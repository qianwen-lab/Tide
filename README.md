# Tide PWA V7.9

Small Progress and Goal Review refinements.

- Forecast trajectory is now a thin pink dashed curve; forecast math is unchanged from V7.7.
- Goal Review JSON now has two layers: `preview` for the compact Goals screen and `review` for the full Summary / Learnings / Next details.
- ChatGPT is explicitly asked to synthesize the entire review into Preview rather than copying the first learning.
- Goals shows only the latest Preview, with a direct link to the full review and history.
- Old V7.7 and earlier reviews remain compatible; when they have no Preview, Tide falls back to the saved Summary / Learnings.
- Same `tide.v1` local data store; no reset.

## V7.9
- Shows the latest active-goal review preview on the Today screen as a compact Goal learning card.
- The card is hidden when the active goal has no saved review.
- Tapping View review opens the full Goal Review and history.
- Storage key and schema remain compatible with V7.8.
