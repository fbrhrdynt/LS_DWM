# DWM v0.8.4

## Formula / calculation
- Recalculates all downstream derived report fields after upstream saves.
- Manual Recalculate formulas button for unlocked legacy/imported reports.
- Expanded formula regression tests for Well, CF1/2/3, Desander/Desilter, Retort, Recovery, Volume Control and Daily Waste.

## Report input UI
- Shakers: compact 6-row table.
- Personnel: Day/Night side-by-side layout.
- By-Passed: percentage + slider, volume, paired depth/unit controls.

## PDF
- Configurable accent color.
- Configurable Engineer section name.
- Configurable Company Activity section name.
- Centrifuge and Retort parameter/unit are now one table cell; no separate unit cell or '-' placeholder for missing unit.
- Removed the vertical blank gap before Oil Recovered.
- Company Activity panel now extends alongside Recovery/Engineer rows to the same bottom line.

## Cleanup
After commit + push:

```bash
npm run cleanup:release
```

This removes only root `DWM-v*.zip` artifacts plus obsolete `DEPLOY_v0.6.2.md` and `DEPLOY_v0.7.md` files. It does not touch backups, uploads, `.env`, SQLite, `node_modules`, or application source.
