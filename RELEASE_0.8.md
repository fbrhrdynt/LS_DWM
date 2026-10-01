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

- Dry-run report renumber tool for legacy projects with duplicate/decimal numbering.
