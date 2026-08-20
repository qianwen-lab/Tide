# Tide PWA V4

Tide is a local-first mobile weight-goal tracker designed for GitHub Pages and iPhone Add to Home Screen.

## V4 product decisions
- Chinese-first UI with English toggle.
- Bottom navigation: Today / Calendar / Change / Goals / Settings.
- No Add tab and no period/cycle tracking in V1.
- Morning fasting weight is the canonical weight entry.
- Today clearly separates Current Goal, Today's Plan, and Today's Actual.
- Food tracking: vegetables, fruit, no snacks, no food after 6 PM, satiety, water.
- Movement uses weekly goals plus daily actuals: 10k-step days, stretch, cardio minutes, strength minutes.
- Calendar cells use tiny dots only: food, movement, special plan. No weight numbers in cells.
- Past/today/future dates can be opened from Calendar; future dates support plan mode and life events.
- Weight Change chart has axes, fasting-weight line, dashed 7-day average, explicit goal line, and tap/hover detail.
- Dynamic insight changes with recent data and execution.
- Archived goals show reached / close / ended plus progress and process summary.
- Weekly review included.
- Local storage + JSON export/import backup.
- No push notifications in V1.
- Flat repository structure for GitHub web upload.

## Publish
Upload all files in this folder to the root of the GitHub repository, then deploy GitHub Pages from `main` / `(root)`.
