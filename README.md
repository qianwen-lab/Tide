# Tide Private V9.1

Update **only the ORIGINAL PRIVATE Tide GitHub repository**. Do not upload to `Tide-Beta`.

## Before updating
1. In the existing Tide app use **Settings → Export Data** to save a JSON backup.
2. Replace the eight files at the **root** of the private `Tide` repository, with no subfolders.
3. Wait for GitHub Pages deployment. Reload or close/reopen the installed app and verify Settings → Version 9.1.0.

## Changes
- Rename the chart category **Food context → Diet**, display only; the original `food` storage ID is deliberately unchanged.
- Move **Customize** inline with the chart legend. Replace the confusing caption with a plain explanation: dots below morning weight show selected logs from the **previous day**, not causation.
- **No snacks source corrected:** show a Diet dot for `food.noSnack === true` on D-1, never for `false` or `null`. Three explicit choices in the same existing daily tracker: No snacks / Had snacks / Not logged. There is no duplicate Life Event. Historical values remain unchanged.
- Migrate the prior V9.0 chart source selection `snacks` to `no_snacks` while preserving its selected state.
- **Exercise can be selected** even if two categories are already on: a third choice replaces the earliest selected and displays a notice. Chart still has at most two dot rows.
- New Custom Event requires just a name; it starts under Other. To show it under Diet, change the chart category in Manage custom. Removing an event still retains old dated records.
- Original private Tide storage key `tide.v1` remains unchanged. Schema v13. Original weigh-ins, goals, reviews, End Goal and historical data are preserved. Beta is not modified.

## No snacks date rule
For morning weigh-in dated D, selected **No snacks** shows one Diet dot only if the record on D-1 explicitly says `noSnack: true`. On D-1, `false` means had snacks; `null` means not logged. Same-day data is not used for this Diet dot. Eating out and alcohol are separate independent sources; they can still produce a Diet dot even when No snacks is false, if selected. Sleep is recorded on the weigh-in morning and remains a separate time exception in Other.

Eight flat files: `index.html`, `app.js`, `styles.css`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`, `README.md`.
