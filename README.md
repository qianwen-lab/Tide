# Tide Private V9.2

**Private Tide only.** Update the original `Tide` GitHub repository, **not** `Tide-Beta`. The original PWA name/icon, GitHub path, and storage key `tide.v1` are unchanged. No new daily inputs or data fields. Existing Goal, weights, review history and custom events are retained.

## Safe upgrade
1. In private Tide, open **Settings → Export Data** and save a dated JSON backup before replacing any files.
2. Unzip this archive. Upload all **eight files directly to the root** of the original private `Tide` repository (not a nested folder). Replace the older versions.
3. Wait for GitHub Pages to deploy, then fully close/reopen the installed Home Screen app if necessary. Confirm **Settings → Version 9.2.0**. If you see the old interface, reload the GitHub Pages page once to refresh the service worker.

## Changes
- **Snacks**, not **No snacks**, is the chart source. For weigh-in date D, the Diet dot occurs ONLY when `food.noSnack === false` and `skips.noSnack` is not set on D−1. `true` (No snacks), `null` (Not logged), or N/A never triggers that Snacks dot. Other selected Diet sources, such as Eating out and Alcohol, can independently make a Diet dot. A day with several selected Diet sources still gets only one Diet dot, with detail on tap. Daily Log stays exactly as before: `No snacks` / `Had snacks` / `Not logged`.
- Preserve chart source selections on upgrade by converting the V9.1 `no_snacks` preference ID to `snacks`. Older records need no manual migration.
- Four consistent chart group colors: **Diet pink** `#C58D9C`, **Bedtime hunger blue** `#709CC4`, **Exercise green** `#66947A`, **Other gray** `#92979B`. The existing two-category chart limit stays intact.
- Replace the long below-chart note with a compact **ⓘ** beside the context legend. Hover on a desktop or tap on a phone for the previous-day alignment, sleep exception, and non-causation explanation.
- Goal-deadline card: **future** deadline = estimate; **today with a weigh-in** = actual reading; **today without a weigh-in** = `No weigh-in yet`; **past deadline with an exact-date record** = actual; **past deadline without one** = `No weigh-in` (not a made-up estimate).
- The pink forecast curve is future-only and starts at the latest actual weigh-in. If the deadline has passed, the chart includes newer actual weigh-ins and extends a modest distance into the future when a forecast exists.
- Date selection uses larger non-overlapping hit areas, whole-chart nearest-date selection, and real mobile touch coordinates instead of offset synthetic clicks. The last day is selectable even at the right edge. Date detail is refreshed on selection; focus and keyboard are supported.

## Compatibility and limitations
- No changes to the mathematical trend estimator in V9.1. It is still a tentative trend estimate, not a promise or a causal explanation.
- This update changes chart DISPLAY semantics for historical `noSnack:false` records; it does not rewrite the records themselves.
- Tests use synthetic fixtures, not your actual private backup. Your real data is not uploaded or read. Make a backup before installation.
- Installing private and Beta into separate GitHub repositories is essential; do not replace Beta with this package.

Exactly eight flat files: `index.html`, `app.js`, `styles.css`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`, `README.md`.
