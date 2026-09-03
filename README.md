# Tide PWA V8.8

Small context + Goal Review cleanup; existing Tide structure and `tide.v1` data remain intact.

- Alcohol and bowel movement are now single **Life event-style tags**, not separate rows.
  - Alcohol cycles: `Alcohol` → `Alcohol · 1` → `Alcohol · 2+` → off.
  - BM cycles: `BM` → `BM ✓` → `No BM` → unrecorded.
- Adds a **Period** Life event tag.
- Progress uses one combined marker for **Eating out / alcohol**, plus a separate high **Bedtime hunger** marker. Exercise, sleep, and BM are not plotted as markers.
- Progress detail is one compact, naturally wrapping line; sleep only appears when under 6 hours, and BM only when there are 3+ explicitly recorded no-BM days.
- Goal Review export is analysis-oriented:
  - Bedtime hunger is explicitly defined as a 1–5 scale where 5 = very hungry.
  - Sleep is exported as `lastNightSleepHours`.
  - Alcohol uses `none / 1 / 2+`; bowel movement uses `yes / no / null`.
  - A `fieldGuide` and `timingGuide` explain lag/alignment and caution against one-day causal attribution.
- Existing Goal, review history, Progress forecast, End Goal, Daily Thought, navigation, and stored data stay compatible.
