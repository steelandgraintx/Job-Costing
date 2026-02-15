# Job Costing PWA

This is an installable web app for iPhone/iPad/desktop with:
- Editable Settings (material markup, rental markup, CC fee)
- Main job entry form (multi-line labor/material/rental, no descriptions)
- New blank line auto-appears as values are entered (no Add Line buttons)
- Dynamic totals on Main (labor category totals + total labor, materials/rentals with and without markup)
- `Calculate` button on Main saves/updates the job record and opens Summary
- Summary calculations
- Saved jobs table for reporting
- CSV export for spreadsheet reporting
- Offline support (service worker)

## Run locally
From `/Users/janet/Downloads/Codex/JobCostingPWA`:

```bash
python3 -m http.server 8080
```

Then open:
- `http://localhost:8080` on your Mac browser
- `http://<your-mac-local-ip>:8080` on iPhone (same Wi-Fi)

## Install on iPhone
1. Open the URL in Safari.
2. Tap Share.
3. Tap `Add to Home Screen`.

## Data and reporting
- App data is stored in browser local storage on each device.
- Use `Save Job Record` on Summary tab to append report rows.
- Use `Export CSV` on Saved Jobs tab to download spreadsheet-ready data.

## Notes
- This is client-side only (no server database yet).
- If phone browser data is cleared, saved records are removed.
- Date and Job ID are still auto-generated/saved, but hidden on Main.
- Labor rates are now editable only in the `Settings` tab.
# Job-Costing
