# Tide PWA V7.4

Goal Review + Progress polish.

## V7.4 changes
- Goal Review workflow: export goal-scoped JSON, analyze in ChatGPT, import compatible review JSON, and retain learnings/action items with the archived goal.
- Latest review action items can surface on the active Goals page.
- Progress chart wording polished; `Weight` replaces `Fasting weight`.
- Actual chart points are smaller. Tooltip shows date, weight, and 7-day average only (no same-day life event attribution).
- Life event `Dinner out` renamed to `Eating out`; `Long flight` removed. Existing data migrates automatically.
- Progress x-axis uses more compact M/D labels and keeps edge labels inside the chart.
- Storage key remains `tide.v1`; schema migrates automatically.
