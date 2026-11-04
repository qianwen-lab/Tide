# Tide Private V9.4.2 — Compact Progress + Close-to-goal status

**Private Tide only; Beta unchanged.** V9.4.2 is a small visual/result-status update on top of V9.4.1. Data and forecast logic are unchanged.

## Upgrade safely
1. In your current private Tide, export a JSON backup from Settings before updating.
2. Unzip this package and upload the eight files flat to the root of the original `Tide` GitHub repository, **not** `Tide-Beta`.
3. After GitHub Pages deploys, refresh Safari once. Settings should show version `9.4.2`.

## Daily Log: lower friction
- The current **No food after 6 PM / evening cutoff** tracker is retired from new/current Goal and Daily Log screens. Existing historical cutoff records and dated Calendar scoring revisions are preserved so old Calendar evaluations are not rewritten.
- New **Amount eaten** context records `About right`, `More than intended`, or `Not logged`. It is context only: it does not automatically count as a Goal failure or adherence failure.
- **Events & Notes** is moved higher in Daily Log. Event chips save in place instead of rerendering the whole Daily page, so the section stays open while you use it.
- Diet chart context can include **More than intended** alongside Snacks, Eating out and Alcohol. Existing `No snacks` input remains the source for the Snacks chart signal.

## A more responsive Today page
- **Morning response** is a short Chinese interpretation shown after a weigh-in. It distinguishes a one-day change from a sustained recent trend and avoids treating normal daily movement as a proven cause-and-effect result.
- **Daily Thought / 今日一想** is separate from weight feedback. It is written in Chinese, stays stable for the day, and rotates through body, mindset, relationships, life and growth rather than focusing only on weight loss.
- **Recent progress / Small Wins** now looks only at recent data and shows at most a few meaningful items. Old wins no longer linger indefinitely.
- **Weekly pulse** gives a compact seven-day view of weight trend, no-snacks days, 10K-step days and bedtime-hunger context when those data exist.

## Move standard
- A day counts as **Move** only when it reaches **10,000 steps**, or has at least **20 minutes of Cardio or Strength**.
- Lower step counts are still recorded and displayed, but do not receive Move completion credit.

## Goal editing
- **Edit Goal** now has **Cancel**. If there are unsaved changes, Tide asks whether to discard them or keep editing. Discard restores the entire edit snapshot, including hidden state affected by tracker-role edits.
- Goal Start and End date inputs are more compact and sit side-by-side where screen width allows.
- The retired evening-cutoff tracker is not offered in current Goal editing.

## Past Goal Review
- Past Goal Review includes a **Final Progress Snapshot** with weight history, Goal boundaries, target and selected context markers.
- Newly archived goals save a frozen snapshot at archive time. Older archived goals without a saved snapshot reconstruct one from the historical records and label it accordingly.
- Goal Review export instructions and JSON schema include the new `moreThanIntended` context so an analysis JSON can be imported back into Tide without additional prompt-writing.

## Preserved behavior from V9.3.x
- Progress uses earlier real weigh-ins instead of showing a blank chart at the start of a new Goal.
- Two suitably spaced readings can produce an explicitly provisional early forecast; the established robust forecast remains for richer histories.
- Previous-day context mapping, including Snacks, remains attached to the following morning weigh-in.
- Calendar scoring uses dated rule revisions so later Goal edits do not retroactively rewrite prior-day evaluations.

## Package
Exactly eight flat files: `index.html`, `app.js`, `styles.css`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`, `README.md`.


## V9.4.1 changes
- Progress deadline card now keeps `By <date>` and `<weight> kg` on one line and removes the redundant `Forecast` word.
- Removed the visible “Earlier weigh-ins…” caption; historical points remain in the chart.
- Archived Goals are condensed and always show a clear colored outcome: Goal reached / Goal not reached / No final weight.
- Removed archived-goal process clutter and percentage bars; detailed history remains in Review.

## V9.4.2 changes
- Progress header shows Weight and Target together on one compact line.
- Archived Goals add a warm `Close to goal` state when the final weight is within 0.5 kg of target but does not meet the reached threshold.
- The close state shows the remaining distance in kg.
