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
