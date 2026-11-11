# Tide Private V9.6 — Trend-first weight management

**Private Tide only; Beta unchanged.** V9.6 deliberately narrows Tide back to weight management: fewer required inputs, stronger trend interpretation, and one new eating-control signal. Legacy calorie/meal data are preserved in backups but are no longer part of the active UI, chart, or Goal Review analysis.

## Upgrade safely
1. Export a JSON backup from the current private Tide first.
2. Upload the eight files from this package flat to the root of the original `Tide` GitHub repository, not `Tide-Beta`.
3. After GitHub Pages deploys, refresh Safari once. Settings should show `9.6.0`.

## Today: trend first
- The main weight number is now the recent **7-day average**, with comparison against the previous seven-day window when available.
- Today’s raw scale weight remains visible and editable, but it is no longer the only headline number.
- Morning response is intentionally direct. It distinguishes a bad-looking single weigh-in from a genuinely rising trend, and gives stronger feedback when the trend or eating-control pattern is actually worsening.
- Morning response never treats one higher morning as proof of fat gain and does not recommend compensatory restriction or excessive exercise.

## Three core daily signals
The prominent daily inputs are now:
- **吃到停不下来** — already intended to stop eating, but continued / felt unable to stop.
- **吃得比计划多** — overall amount was more than intended, without implying loss of control.
- **睡前饥饿 1–5** — context for sustainability; high hunger is not success.

Tapping a selected Yes/No or hunger value again clears it. Older food trackers (No snacks, vegetables, protein, fruit, water) remain available under **More context** so existing data and optional use are preserved without dominating the daily flow.

## Calories retired from the active product
- Breakfast/Lunch/Dinner/Other calorie entry and Healthy/Mixed/Unhealthy meal labels are removed from active screens.
- The calorie band is removed from Progress.
- Calories are removed from Goal Review exports and interpretation instructions.
- Previously recorded `meals` data remain untouched inside the local database / full backup so upgrading does not destroy history.

## Progress
- Progress now shows **Scale** (lighter raw line) and **Trend** (darker 7-day line) at the same time.
- Existing pre-goal history, Goal start/end markers, Target, and the pink estimate line remain.
- Context dots still map previous-day logs to the following morning weigh-in; this is context, not proof of causation.
- `吃到停不下来` and `吃得比计划多` are available as Diet context sources.
- The target-date card uses an **estimate window** rather than pretending the trend can predict one exact future day.

## Weekly review
- Separate Recent Wins / Small Wins and Weekly Pulse cards are removed from Today.
- One weekly review summarizes: recent 7-day average, `吃到停不下来`, `吃得比计划多`, and average bedtime hunger.
- It provides one concise interpretation and one next action. Repeated loss-of-control eating is prioritized over snacks, minor exercise misses, or cosmetic tracker completion.
- Progress no longer repeats the old “Weekly behavior” block before the weekly review; detailed Goal tracker history remains available in Goals / Review.

## Goal Review export
- Export keeps the exact direct-import JSON contract.
- New `food.uncontrolledEating` is documented as the highest-priority eating-control signal.
- Review instructions explicitly prohibit compensatory restriction or excessive exercise after an episode.
- Meal calories and diet-quality fields are no longer exported for analysis.

## Preserved behavior
- Existing data use the same `tide.v1` storage key and migrate forward; no historical field is deleted.
- Calendar rule history remains dated so later Goal edits do not rewrite older Calendar evaluations.
- Earlier weigh-ins can support a new Goal’s chart/forecast without being counted as current-Goal adherence.
- Forecast robust-estimation logic is preserved; only the target-date presentation becomes a range.
- Archived Goal snapshots, custom events, Events & Notes, Goal Review import, and Edit Goal cancellation remain intact.

## Package
Exactly eight flat files: `index.html`, `app.js`, `styles.css`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`, `README.md`.
