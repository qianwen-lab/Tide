# Tide 9.4.1 — Clearer, shorter screens

Tide is a local-first, offline-capable personal tracker. This release adds a simple daily return flow while preserving existing goals, reviews, weigh-ins, and original food records.

## What changed

- **Today:** The goal progress ring is back at the top. Large Focus headings and explanatory paragraphs are removed. Snack logging is compact, with distinct neutral, green and rose states.
- **Evening food:** One collapsed row; expand it to edit food/portions or log it. **Dinner out** is a separate toggle. It neither marks extra snacks nor automatically records or skips the optional evening snack. Dinner-out records appear in Calendar, next-morning chart context and goal exports.
- **Progress:** **Goal** is the default range: the goal interval plus up to seven days of earlier readings. **30D**, **90D** and **All** start at the first available reading in that range, removing empty leading space. Actual measurements, the seven-day average and optional future estimates remain separate. Missing stretches are not interpolated.
- **Tracking:** Goal tracking and **Other signals** have separate weekly rows. Sleep, hunger and logged non-goal trackers are visible without being graded as successes or failures.
- **Review:** Three short lines: **Trend**, **Pattern**, **Next**. Patterns use recorded recent history and minimum evidence thresholds. Raw figures and saved reviews are collapsed. Sparse logs never generate confident explanations.
- **Past goals:** Small chart cards use green for progress, rose for weight increases, amber for little change, and gray for uncertain or inconsistent data. Text labels accompany every color.
- **Returning:** After extra snacks, choose **Back to my plan tomorrow**. Tomorrow shows **Back to plan today**; only an explicit no-extra-snacks log earns **Back on plan ✓**. Corrections remove completion, and missing days remain unknown.
- **Preserved:** Editable evening plans, original food and weight records, dated scoring rules, archive choices, cancelable goal edits and optional review import/export. Ending a goal never automatically lowers the next target.

## Updating the app

Deploy these nine runtime files together to the existing Tide site:

`index.html`, `app.js`, **`journey.js`**, `styles.css`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`, `README.md`.

`journey.js` is new and must be loaded before `app.js`. There is no build step and no runtime npm dependency. Settings displays **9.4.1**. Existing installations retain the `tide.v1` storage key, with an automatic schema-15 migration. A JSON backup can still be exported or restored under Settings.

The service worker includes the new script in its offline cache. After deploying, reopen or refresh the app to load the new version. This repository change by itself does not deploy a hosted site.

## Data compatibility

- Legacy `food.noSnack` and `food.stop6` values are preserved. Starting on `journey.effectiveFrom`, `food.extraSnacks` is authoritative: `true` means extra snacks, `false` means none, and `null` means unknown. A skipped log remains unknown. Historical snack labels retain their original meaning.
- `journey.eveningPlans` stores dated defaults; daily `eveningPlan` stores an override or the plan associated with a logged meal. `eveningOut` is a separate dinner-out record. `eveningFood` is a separate optional actual record. Editing a later default does not rewrite earlier dates.
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

The 36 automated tests exercise the rendered DOM and real event handlers: migration, persistence, date rollover, return corrections, evening edits, historical charts, sparse data, archive boundaries, next-step choices, goal-edit cancellation and review exports. `linkedom` is only a development dependency.

This release was also checked in Chromium at 390px and 320px widths: nine screen states, no horizontal overflow or page errors, evening editing, dinner-out persistence, chart keyboard selection, and offline reopening. Native iPhone Safari and installed-PWA behavior still need device verification. The app stores data in the current browser; it does not provide cross-device sync.
