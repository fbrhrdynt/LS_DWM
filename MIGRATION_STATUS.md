# DWM Rewrite Status

DWM is being rewritten from the legacy Laravel application to a lightweight Node.js + EJS + SQLite application.

## Implemented

- DWM branding
- Node.js 22 + Express + EJS
- SQLite embedded database (`node:sqlite`)
- Legacy MariaDB/MySQL dump importer
- Existing Laravel bcrypt password compatibility
- Signed cookie session
- Login/logout
- Login rate limiting
- CSRF protection
- Server-side role and project isolation
- Dashboard statistics
- Account management for MASTER
  - create
  - edit
  - password change
  - role/project assignment
  - activate/deactivate
  - safe delete rules
- Project management for MASTER/Supervisor
  - create
  - edit
  - delete safeguards
  - automatic initial daily report creation
  - transactional creation of linked report records
- Project/report list scoped to the logged-in user
- Daily Report read-only overview
  - well information
  - active mud properties
  - shakers
  - centrifuge 1/2/3
  - cutting dryer 1/2
  - desander/desilter summary
  - cuttings bypassed / daily waste
  - personnel
  - activities
- Mobile-first responsive shell
- Light/dark mode from system preference
- Compression
- versioned static assets + service-worker cache
- PM2 config
- Nginx config example
- SQLite database checker and backup command

## Still being rewritten before full feature parity

- Daily Report editing forms
- Report create/copy workflow beyond the automatic first report
- Report lock/unlock workflow
- Full retort worksheet editing and calculations
- Detailed Desander / Desilter editing
- Cuttings bypassed editing
- Daily waste editing
- Personnel editing
- Additional / activities editing
- Project logo upload/migration
- PDF generation
- Excel well summary export
- Assets CRUD / COC files
- Preventive maintenance
- PM document library
- Inspection categories/details/certificates
- Forgot/reset password email workflow
- ownCloud/WebDAV integration
- Full regression/security tests

Do not retire the legacy application until this checklist reaches feature parity and production data has been migrated from the latest source database.
