# Tide PWA V8.4

Small Progress-context experiment; existing Tide structure stays intact.

- Adds lightweight daily context inputs for **Alcohol** (`None / 1 / 2+`) and **Bowel movement** (`Yes / No`).
- Progress weight points can show tiny previous-day context markers for notable food/alcohol, high bedtime hunger, significant exercise, short sleep, and 3+ consecutive explicitly logged days without a bowel movement.
- Bowel movement appears on-chart only as a quiet numbered marker (`3`, `4`, `5`...) after 3 days; it is context only, never adherence.
- Tapping a weight point shows one compact context line with concrete previous-day details.
- Sleep is aligned to the sleep immediately before that morning weigh-in; food, alcohol, bedtime hunger, exercise, and bowel-movement streak come from the prior calendar day.
- Goal review exports now include alcohol and bowel-movement context.
- Existing `tide.v1` data, navigation, Goal logic, End Goal, and Daily Thought remain compatible.
