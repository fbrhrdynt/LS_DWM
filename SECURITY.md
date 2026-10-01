# DWM v0.7 Security & Recovery

## Password reset

Routes:

- `GET /forgot-password`
- `POST /forgot-password`
- `GET /reset-password/:token`
- `POST /reset-password`

Reset tokens:

- 32 random bytes
- only SHA-256 hash is stored in SQLite
- single use
- default validity: 15 minutes
- previous unused token is invalidated when a new token is requested
- password reset bumps `user_security.session_version`, invalidating existing sessions

## SMTP

Configure in `.env`:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=user@example.com
SMTP_PASS=secret
SMTP_FROM="DWM <dwm@example.com>"
```

The Forgot Password response is intentionally generic to avoid revealing whether
an email exists in the account database.

## Audit

`MASTER` users can open:

- `/settings/audit`
- `/settings/security`

Audit logging stores:

- actor user ID
- action
- HTTP method/path
- response status
- IP address
- user-agent
- timestamp

Request bodies, passwords and reset tokens are not stored.

## Full backup

```bash
npm run backup:full
```

The backup contains:

- a safe SQLite backup made with `node:sqlite`
- all `storage/uploads`
- `manifest.json` with SHA-256 checksums

`.env` is intentionally excluded.
