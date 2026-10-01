# DWM Rewrite Status

## Foundation implemented

- DWM branding
- Node.js + Express + EJS
- Embedded SQLite database; MySQL service is no longer required
- One-time importer from the legacy MySQL/MariaDB SQL dump
- Existing Laravel bcrypt password compatibility
- Signed cookie session with minimal payload
- Login/logout and login rate limiting
- CSRF protection
- Role-aware access foundation
- Project isolation for Operator/Staff
- Project list and report list
- Dashboard statistics
- Mobile-first responsive shell
- Compression and static caching
- PM2 and Nginx examples
- Database compatibility checker

## Still to reach full feature parity

- Account CRUD and account status management
- Project CRUD
- Full Well Report editing
- Well information
- Active Mud Properties
- Shakers
- Centrifuge 1/2/3
- Cutting Dryer 1/2
- Desander / Desilter
- Retort worksheet
- Cuttings bypassed
- Daily waste
- Personnel
- Additional / activities
- Report copy
- Report lock/unlock
- PDF generation
- Excel summary export
- Assets / COC
- Preventive maintenance
- PM document library
- Inspection categories/details/certificates
- Forgot/reset password
- ownCloud/WebDAV integration
- Full regression/security tests

Do not retire the legacy production application until this checklist is complete and verified.
