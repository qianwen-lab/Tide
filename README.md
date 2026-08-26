# Tide PWA V8.2

Goal/Progress structure polish without redesigning Tide.

- Weekly 1×7 behavior grids now live in **Progress**, directly under the Weight/forecast area.
- Goals shows a compact **goal-to-date Tracking record** instead of the weekly grid.
- Goal tracker role changes preserve existing tracker data and activation dates; Focus no longer resets or suggests roles in Edit Goal.
- Edit Goal ends with two explicit actions: a subdued **End & Archive** on the left and primary **Save** on the right. Archiving requires a second in-app confirmation.
- Progress x-axis uses one fixed calendar-day tick interval so date labels and pixel spacing are truly even, while remaining inside chart bounds.
- Existing `tide.v1` data and schema remain compatible.
