# DWM Rewrite Status

This package is the Node.js foundation for the DWM rewrite.

## Implemented in this foundation

- DWM branding
- Node.js 22 + Express
- EJS server-side rendering
- Existing MySQL/MariaDB schema compatibility
- Existing Laravel bcrypt password compatibility
- Session storage in MySQL (`dwm_sessions`)
- Login/logout
- Login rate limiting
- CSRF protection
- Role-aware access foundation
- Project isolation for Operator/Staff
- Project list
- Report list per project
- Dashboard statistics
- Mobile-first responsive shell
- Dark mode via system preference
- Compression
- Static asset caching
- Static-only service-worker cache
- PM2 config
- Nginx config example
- Database compatibility checker

## Not yet feature-parity

The following legacy modules still need to be rewritten before Laravel can be retired:

- Account CRUD and account status management
- Project CRUD
- Well report detail
- Well information editing
- Active Mud Properties
- Shakers
- Centrifuge 1/2/3
- Cutting Dryer 1/2
- Desander
- Desilter
- Retort worksheet
- Cuttings bypassed
- Daily waste
- Personnel
- Additional / activities
- Report copy
- Report lock/unlock
- PDF generation
- Excel summary export
- Assets CRUD / COC
- Preventive maintenance
- PM document library
- Inspection categories/details/certificates
- Forgot/reset password
- ownCloud/WebDAV integration
- Full regression/security tests

Do not switch the production domain away from Laravel until the feature-parity checklist is complete.
