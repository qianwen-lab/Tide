# Tide 9.5.0 — Small wins

Tide is a local-first, offline-capable personal tracker. This release adds positive feedback and useful context while keeping the daily screen compact and preserving existing records.

## What changed

- **Today:** A compact **On plan** row with seven weekly dots. Explicit no-extra-snack days count; planned evening food is allowed. Dinner out, missing logs and future dates do not create successes or failures. A completed day gets a brief animation, with reduced-motion support.
- **Returning:** The first actual on-plan day after extra snacks earns **Back on plan**, even after a gap. No promise is required. Consecutive on-plan days do not create extra returns. The optional **Back to my plan tomorrow** commitment remains available but never earns credit by itself.
- **Small wins:** Tap the weekly row or **Small wins & collection** in Progress for lifetime days and return counts. At 3, 7 and 14 cumulative days, collect **First shell**, **Gentle tide** and **New light**. Earlier eligible logs count immediately; they do not replay old celebrations. Breaks and new goals keep earned pieces. Correcting or clearing logs recalculates counts and earned pieces. Repeated taps and reloads never replay the same reward.
- **Review:** Three short rows—**Trend**, **Pattern**, **Next**—plus one supported positive observation from the latest seven days when available. Movement counts as a real effort even when it is not a Goal tracker. Archived reviews stay within that goal's dates.
- **Useful context:** Sleep, hunger and actual evening-food records can suggest one adjustment. Comparison patterns require at least three paired records in each group, at least three snack days in the higher-rate group, and a difference of at least 30 percentage points. These are exploratory associations, not causes or clinical thresholds. Exact counts and dates stay inside collapsed **Data**. Different snack-policy periods are not pooled in a comparison.
- **Progress:** Point selection shows previous-day food, movement and hunger, plus the sleep logged on the weigh-in morning, including normal sleep values. Skipped observations remain unknown. Goal tracking and Other signals remain separate; the latter is available even between goals.

The existing goal ring, editable evening food, independent **Dinner out**, continuous weight history, default **Goal + previous 7 days**, cropped rolling ranges, and shaded past-goal cards are retained. The seven-day average needs three readings; gaps stay open. Ending a goal never automatically lowers the next target.

## Updating the app

Deploy these nine files together to the existing Tide site:

`index.html`, `app.js`, `journey.js`, `styles.css`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`, `README.md`.

`journey.js` must load before `app.js`. There is no build step or runtime npm dependency. Settings displays **9.5.0**. Existing installations retain the `tide.v1` storage key and migrate automatically to schema 16. The service worker caches the new scripts for offline use. Reopen or refresh after deployment. Editing this repository does not itself deploy a hosted site.

## Data compatibility

- Legacy `food.noSnack` and `food.stop6` remain unchanged. From `journey.effectiveFrom`, `food.extraSnacks` is authoritative: `true` means extras, `false` means none, `null` means unknown. A skipped record stays unknown. Before that date, the original `noSnack` rule applies. The cutoff is no longer scored.
- `journey.eveningPlans` holds dated defaults; a daily `eveningPlan` is an override or the plan associated with a logged meal. `eveningFood` and `eveningOut` are independent actual records. Editing a later default does not rewrite older dates.
- `journey.returns` preserves explicit commitments. Return totals now derive from actual snack records across the full history, so earlier returns without commitments also count.
- `journey.encouragement` stores only celebration receipts: `seenDays`, `seenReturns` and `seenMilestones`. Counts, badge eligibility and earned dates derive from the current dated records, not these receipts. They survive export/import and prevent repeated animations.
- Archives retain original snapshots, reviews and weight values. New archives include `endWeightDate` and `archivedAt`; inconsistent legacy snapshots are flagged without being overwritten.
- Goal-data exports include local review evidence, a supported small win, lifetime totals as of the review date, and actual return flags. Existing review JSON imports remain compatible.

Personal backups and health records must never be committed. Automated tests use synthetic fixtures.

## Verification

With Node 20 or later:

```sh
npm ci
npm test
```

All **60 tests** pass, covering migration, original records, day/return counts, gaps and corrections, week rollover, goals, milestones, celebration deduplication, evening food, policy boundaries, review evidence, chart context, and exports. `linkedom` is a development dependency only.

Browser verification used Chromium at **390px and 320px** widths across 18 screen states. Checks cover layout, touch and keyboard interaction, reduced motion, award feedback, evening edits, chart selection, actual backup export/import, and offline reopening. Native iPhone Safari and installed-PWA behavior have not been tested on a physical device. Data stays in the current browser; cross-device sync is not provided.
