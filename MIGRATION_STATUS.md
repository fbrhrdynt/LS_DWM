# DWM Rewrite Status

DWM is being rewritten from the legacy Laravel application to a lightweight Node.js + EJS + SQLite application.

## Implemented through v0.5.0

- DWM branding
- Node.js 22 + Express + EJS
- SQLite embedded database (`node:sqlite`)
- Legacy MariaDB/MySQL dump importer
- Existing Laravel bcrypt password compatibility
- Signed cookie session, login rate limiting and CSRF protection
- Server-side role and project isolation
- Dashboard statistics including PM/inspection due within 30 days
- MASTER account management
- MASTER/Supervisor project management
- Transactional initial Daily Report creation
- Daily Report editable workflow and automatic calculation engine
- Report lock/unlock, copy and safe deletion
- Asset List CRUD
- COC upload/download
- Inspection categories
- Inspection records, certificate upload/download and expiry monitoring
- Preventive Maintenance categories
- PM history with automatic due-date calculation from category frequency
- PM status and due/overdue indicators
- Equipment/document categories
- PM document library with secure upload/download/delete
- Multipart CSRF verification for uploads
- Server-side file lookup by database ID (no arbitrary public file path route)
- Mobile-first asset/maintenance/inspection pages
- Versioned static assets + service-worker cache
- PM2 and Nginx examples
- SQLite database checker and backup command
- Daily Report formula regression checks
- Maintenance date-calculation regression checks

## Still being rewritten before full feature parity

- Project logo upload/migration
- PDF Daily Report generation
- Excel Well Summary export
- Forgot/reset password email workflow
- ownCloud/WebDAV integration
- Full automated regression/security test suite
- Migration utility for legacy uploaded COC/certificate/PM document files

The legacy application should remain available until the remaining items are implemented and the latest production data/files have been migrated and verified.


## v0.5.1 completed

- [x] Manual Light mode
- [x] Manual Dark mode
- [x] Persist theme preference
- [x] Horizontal legacy-style Retort worksheet
- [x] Mobile horizontal scroll for Retort
- [x] Retort automatic formulas preserved


## v0.6 completed

- [x] Daily Report PDF
- [x] PDF inline preview
- [x] PDF direct download
- [x] Server-rendered OOC chart
- [x] Excel Well Summary
- [x] Legacy 90-column Well Summary layout
- [x] Export project authorization


## v0.6.1 PDF correction

- [x] Reverted PDF orientation to A4 portrait
- [x] Restored legacy compact report layout
- [x] Restored combined Centrifuge/Shaker table
- [x] Restored Desander/Desilter side-by-side placement
- [x] Restored horizontal Retort layout
- [x] Restored right-side Cuttings By-Passed / Daily Waste / OOC chart blocks
- [x] Restored right-side activity blocks
- [x] Preserved DWM server-side PDF generation


## v0.6.2 completed

- [x] PDF layout parity pass against legacy Laravel PDF
- [x] Global company logo upload
- [x] Per-project client logo upload
- [x] Editable PDF title/header text
- [x] Integer-only report numbers
- [x] Copy report date = source report + 1 day
- [x] Copied mud-check date follows copied report date


## v0.7 completed

- [x] Forgot Password
- [x] One-time hashed password reset tokens
- [x] SMTP configuration
- [x] Self-service Change Password
- [x] Session invalidation after password change/reset
- [x] Audit Trail
- [x] Security settings/status page
- [x] Full SQLite + uploads backup
- [x] CSP and security-header hardening
- [x] Login/reset rate limits


## v0.8 completed

- [x] Notification center / due alerts
- [x] Dashboard due/overdue attention list
- [x] Database integrity / orphan checker
- [x] Safe integrity repair
- [x] Cascade delete hardening for imported SQLite schema
- [x] Full backup ZIP + manifest
- [x] Backup verification
- [x] Guarded backup restore
- [x] Legacy Laravel file migration
- [x] Optional ownCloud/WebDAV backup
- [x] System diagnostics UI
- [x] Unified release check

External SMTP/WebDAV credentials remain environment configuration only.


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


## v0.8.6 Legacy parity

- Restored legacy Centrifuge dropdowns for Model, Mode of Operation, Feed-in Suction, Effluent Return and Underflow.
- Active Mud category labels now derive from fluid type exactly like the Laravel report logic.
- Water-base fluids show MBT + Base Fluid; oil-base fluids show E-Stability + Oil/Water Ratio.
- Restored exact legacy CF1 vs CF2/CF3 metric Mass Cake formulas.
- Waste & Activity uses the same dynamic activity label as the PDF setting.
