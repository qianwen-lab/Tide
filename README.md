# Tide Private V9.0

Update **only the ORIGINAL PRIVATE Tide GitHub repository**. Do not upload to `Tide-Beta`.

## Before updating

1. Open your existing private Tide and use **Settings → Export Data** to save a JSON backup.
2. Replace the eight files at the ROOT of the original `Tide` repository (no folders).
3. Wait for GitHub Pages to finish publishing, then close and reopen Tide. If it still shows an old version, reload the page.

## What's new

- **Chart settings:** choose up to two marker categories among Food context, Bedtime hunger, Exercise, and Other context. Select signals inside each category. This changes chart dots only, not goals or original records.
- **Snacks:** no duplicate Life Events control. The chart reads the existing `No snacks` field; `false` indicates snacks, while an unanswered value remains unknown.
- **Custom events:** one list shared by Life Events and Chart Settings. Add an event on a day, set its category to Food or Other, and optionally show it on the chart. Manage names from the day page, chart settings or Settings.
- **Remove safely:** confirmation is required. Removal hides a name from new choices and chart settings while keeping historical records and full backups. Removed names can be restored; archived labels remain visible but read-only on past days.
- **Period:** optional under Other context, without automatic weight or forecast corrections.

## Compatibility

- The original `tide.v1` localStorage key, app identity, goals, weigh-ins, reviews, End Goal, and old bowel-movement data are retained. Schema migrates from v11 to v12. It is not a cloud backup.
- Forecast uses the same V8.9 model. Forecasts are estimates, not promises.
- Older free-text custom event names are recovered from dated records into the shared catalogue.
- Eight flat files: `index.html`, `app.js`, `styles.css`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`, `README.md`.
