# Tide PWA V6

V6 focuses on the active goal and keeps V5 data compatible.

## V6 changes
- New balanced Morandi sage + dusty-rose visual system, no decorative patterns.
- Rotating daily reminders with a sharper tone.
- Change page is locked to the active Goal start/end dates.
- Forecasts projected weight on the Goal end date and estimated target date.
- Weight chart Y-axis uses integer tick marks; actual values remain decimal in tooltips.
- Forecast line added alongside actual weight, 7-day average, and target.
- Data key remains `tide.v1`; schema migration upgrades V5 records to V6 without clearing local data.
- JSON export/import remains available as a manual backup.

## Publishing
Upload all 8 files in this folder to the root of the existing GitHub Pages repository and overwrite the old files.
