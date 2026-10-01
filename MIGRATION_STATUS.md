# DWM Rewrite Status

DWM is being rewritten from the legacy Laravel application to a lightweight Node.js + EJS + SQLite application.

## Implemented through v0.4

- DWM branding
- Node.js 22 + Express + EJS
- SQLite embedded database (`node:sqlite`)
- Legacy MariaDB/MySQL dump importer
- Existing Laravel bcrypt password compatibility
- Signed cookie session, login rate limiting, CSRF protection
- Server-side role and project isolation
- Dashboard statistics
- MASTER account management
- MASTER/Supervisor project management
- Automatic initial report creation inside a transaction
- Project/report lists scoped to the logged-in user
- Daily Report overview
- Daily Report editable sections:
  - Report Info
  - Well Data
  - Active Mud Properties
  - Shakers 1-6
  - Centrifuge 1-3
  - Cutting Dryer 1-2
  - Desander
  - Desilter
  - Cuttings By-Passed
  - Daily Waste + BSS/Rig Activities
  - Personnel
  - Full Retort worksheet fields + volume-control/finalize fields
- Report lock/unlock using project access code
- Unlock attempt rate limiting
- Copy current report as the next report
- Safe report deletion for MASTER/Supervisor
- Locked reports are read-only on the server, not only in the UI
- Mobile-first report editor with section navigation and sticky save action
- Versioned static assets + service-worker cache
- PM2 and Nginx examples
- SQLite database checker and backup command

## Still being rewritten before full feature parity

- Verify/port legacy calculated Daily Waste formulas
- Retort automatic calculations/derived values parity
- Project logo upload/migration
- PDF daily report generation
- Excel well summary export
- Assets CRUD / COC files
- Preventive maintenance
- PM document library
- Inspection categories/details/certificates
- Forgot/reset password email workflow
- ownCloud/WebDAV integration
- Automated regression/security tests

The legacy application should remain available until the remaining items are implemented and the latest production data has been migrated and verified.
