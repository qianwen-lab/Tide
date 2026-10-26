# Tide 9.4 — Return to your rhythm

Tide is a local-first, offline-capable personal tracker. This release adds a simple daily return flow while preserving existing goals, reviews, weigh-ins, and original food records.

## What changed

- **Today:** Extra snacks and planned evening food are separate. Log either without completing the other. Evening food is optional; edit its food and portions for one date or as a dated default for future days.
- **Returning:** After logging extra snacks, choose **Back to my plan tomorrow**. Tomorrow shows **Today is a return day**. **You came back. ✓** appears only after an explicit no-extra-snacks log. Correcting or clearing the log removes that completion. No reminders are scheduled, and missing days are never treated as completed or failed returns.
- **Eating time:** The cutoff is removed from current goals and bonus scoring from the upgrade date. Historical cutoff logs and historical Calendar rules remain available. Planned evening food is allowed.
- **Progress:** 30-day, 90-day and all-time history continues across goals. Actual readings and a calendar-based 7-day average are separate; the average needs at least three readings. Gaps longer than three days are not joined. The current goal is a shaded interval, and an optional 14-day estimate uses recent history, including readings before the goal.
- **Reviews:** A local review shows dated weight change, average coverage, snack logging coverage and a practical next step without requiring ChatGPT. Unlogged days are unknown. Older archive discrepancies and stale end readings are flagged without rewriting their saved values.
- **Next chapter:** Ending a goal preserves a dated snapshot, then offers Continue target, Adjust plan, Maintain or Just record. A new lower target is never generated automatically. The review date is a checkpoint rather than a countdown to failure.
- **Editing:** Goal edits can be canceled, and changing a goal's starting-weight metadata never invents or overwrites a real weigh-in.

## Updating the app

Deploy these nine runtime files together to the existing Tide site:

`index.html`, `app.js`, **`journey.js`**, `styles.css`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`, `README.md`.

`journey.js` is new and must be loaded before `app.js`. There is no build step and no runtime npm dependency. Settings displays **9.4.0**. Existing installations retain the `tide.v1` storage key, with an automatic schema-15 migration. A JSON backup can still be exported or restored under Settings.

The service worker includes the new script in its offline cache. After deploying, reopen or refresh the app to load the new version. This repository change by itself does not deploy a hosted site.

## Data compatibility

- Legacy `food.noSnack` and `food.stop6` values are preserved. Starting on `journey.effectiveFrom`, `food.extraSnacks` is authoritative: `true` means extra snacks, `false` means none, and `null` means unknown. A skipped log remains unknown. Historical snack labels retain their original meaning.
- `journey.eveningPlans` stores dated defaults; daily `eveningPlan` stores an override or the plan associated with a logged meal. `eveningFood` is a separate optional actual record. Editing a later default does not rewrite earlier dates.
- `journey.returns` stores explicit return-day commitments. Completion is derived from the corresponding actual log, not from opening the app or tapping a promise.
- New goal archives store `endWeightDate` and `archivedAt`. Their end reading must lie inside the goal interval and no later than the review date. Legacy snapshots remain unchanged even when a dated reading disagrees.
- The optional goal-data export includes policy timing, prior-weight context and dated rule revisions. Existing review JSON imports remain supported.

Personal backups and health records must never be committed. The tests use synthetic fixtures.

## Verification

Run with Node 20 or later:

```sh
npm ci
npm test
```

Tests exercise the rendered DOM and real event handlers: migration, persistence, date rollover, return corrections, evening edits, historical charts, sparse data, archive boundaries, next-step choices, goal-edit cancellation and review exports. `linkedom` is only a development dependency.

The automated suite does not provide mobile Safari layout or installed-PWA coverage. Before publishing, check Today, evening editing, Progress chart selection and offline reopening on a phone. The app stores data in the current browser; it does not provide cross-device sync.
