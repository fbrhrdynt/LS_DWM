# DWM 0.8 Release Candidate

## Completed in 0.8

- Notification center for overdue / due PM and inspections.
- Dashboard attention list.
- SQLite integrity and domain-orphan checks.
- Safe integrity repair for missing report child rows and decimal report numbers.
- Report and project cascade deletion even when the imported legacy DB has no working FK cascades.
- Full backup now creates a directory plus ZIP archive and SHA-256 manifest.
- Backup verification and guarded restore tool.
- Legacy Laravel upload migration for COC, inspection certificates, PM documents, client logos and company logo.
- Optional ownCloud/WebDAV test and backup upload.
- MASTER System diagnostics page with disk/storage/database/integrity status.
- Unified release check.

## Operationally optional

SMTP requires credentials to send reset emails. WebDAV requires ownCloud/WebDAV credentials and an accessible remote endpoint. These are external configuration dependencies, not missing code.

- Legacy URL compatibility redirects for active Laravel bookmarks.
- Backup retention pruning and optional systemd daily backup timer examples.


## v0.8.1 PDF fixes

- Fixed client logo lookup in PDF
- Removed blank placeholders in PDF header
- Improved well-info and active-mud font sizing
- Fixed Effluent Return to alignment
- Fixed bottom recovery/engineer rows alignment
- Removed generated timestamp footer to match legacy layout and avoid extra blank page


## v0.8.2 final PDF parity

- Robust company/client logo path resolution, including legacy Laravel storage paths
- No dash placeholders in the Well Information header
- Units are attached to values in the header
- Larger readable header/Active Mud fonts
- Effluent Return / Screens Changed columns aligned to the equipment grid
- Recovery and engineers rows aligned to the same 72.2% / 27.8% Retort split
- Generated footer restored safely inside page 1
- `npm run pdf:check` regression check ensures the reference-size report remains exactly one page


## v0.8.3 PDF text fitting

- Fixed S… / B… / M… truncated labels and values in PDF tables.
- Removed automatic ellipsis from report cells.
- Corrected double-padding calculation in PDF text fitting.
- Labels now shrink only as needed while preserving the complete text.
- Added regression guard so automatic cell ellipsis cannot be reintroduced silently.
