# Tide Private V9.3.1 — Calendar historical-rule fix

**Private Tide only; Beta unchanged.** This is a focused patch to V9.3. The previously discussed V9.4 wishlist (Cancel Edit Goal, compact date picker, adjustable cutoff tracker design, pre-goal chart history and archived goal chart snapshot) is NOT included.

## Upgrade safely
1. Export your private Tide JSON backup under Settings before updating.
2. Unzip and upload the eight files flat into the original `Tide` GitHub repository root, **not** `Tide-Beta`.
3. Confirm Settings shows `9.3.1` and refresh Safari once if cached.

## Calendar rule revisions
- Calendar food status now evaluates each day against a dated copy of the goal, tracker roles and plan effective on that date. The first subsequent edit saves the existing rules as a baseline; all future edits keep prior rules intact.
- Editing cutoff, thresholds, goal dates, or tracker roles creates a new rule revision without touching original daily food, exercise, event or weight records. Old-day corrections re-evaluate using rules valid for that old date. Past-day plan labels also show the cutoff valid on that date.
- Goal editing and Default Plan editing both expose **Calendar scoring effective from** (default today; future dates accepted). A later edit supersedes a not-yet-effective rule revision. This effective date controls dated Calendar evaluation; goal setup itself is edited immediately.
- Goal archiving also preserves the outgoing goal as historical rules before switching to the new goal.
- Changing a goal's start date without explicitly changing the start weight no longer writes an invented weigh-in into the new start date.
- History is backed up and restored as `calendarRuleHistory` in the existing `tide.v1` JSON data. Old backups migrate without dropping existing data.

**Limit of old versions:** V9.3 did not store earlier cutoff/goal rule versions. Installing this patch cannot reconstruct which rules were used before a cutoff you ALREADY changed. The current setup becomes the migration baseline, and subsequent edits will be preserved.

The calendar revision patch does not alter the forecast, graph appearance, or Snacks marker logic. Exactly eight flat files: index.html, app.js, styles.css, manifest.json, sw.js, icon-192.png, icon-512.png, README.md.
