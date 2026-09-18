# Tide Private V9.3

**Private Tide only.** Do not upload this build to Tide-Beta. The GitHub path, storage key `tide.v1`, icons, app identity, tracker data, goal review history, and model mathematics are unchanged.

## Safe installation
1. Open private Tide → Settings → Export backup and save the JSON.
2. Unzip and upload all eight files flat into the root of the ORIGINAL `Tide` GitHub repository. Do not create a nested folder.
3. After GitHub Pages updates, reopen the installed app; Settings should show version 9.3.0. Reload Safari once if the cached old version remains.

## What changed
- Restored V9.1's visual presentation of the **continuous pink dashed forecast curve**, using the current robust V9.2 estimator. Previous fixes to the Goal date actual card and Snacks D−1 semantics remain. The pink curve is a smoothed model/trend, not actual weigh-ins.
- Removed the ugly blue rectangle from point selection, preserved large mobile tap targets and keyboard access with a discreet focus indication on the point itself.
- Added a subtle vertical **Goal · date** marker at the actual goal end date even when the graph's x-axis extends further into the future. Horizontal target weight remains.
- Removed the confusing sleep explanation from the chart's ⓘ unless **Other → Short sleep** is actually selected. When shown, it explains that the sleep input belongs to that same morning's date. No sleep data or log inputs changed.
- Goal Review export now starts with `READ_THIS_FIRST_FOR_CHATGPT`: includes explicit analysis rules, the exact 3-field top-level / 3-field nested import JSON contract, goalId matching, 1–3 nonempty string requirements, no commentary/fences, and instructions to generate a JSON file if possible. Uploading the export is the entire prompt.
- Goal Review now offers **Import review JSON** alongside Paste; file import previews and validates before saving, and rejects mismatched goalId/extra keys with specific messages. Exported original goal data cannot be mistaken for the completed review.

## Important
- User data are not cleared or re-keyed. No Beta files modified. These are software tests using synthetic data, not your real backup. Export your own backup before upgrading.
- The AI-generated review is external content and should be checked in Tide's Preview before Save; the schema validator cannot verify the truth of analytical claims.

Exactly eight flat files: `index.html`, `app.js`, `styles.css`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`, `README.md`.
