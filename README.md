# DWM

DWM is the lightweight Node.js rewrite of the legacy Laravel application.

## Architecture

- Node.js 22.5+
- Express + EJS server-rendered UI
- Embedded SQLite via Node.js `node:sqlite`
- No MySQL/MariaDB service required
- PM2 + Nginx for production

The production database is a single local file (`data/dwm.sqlite`) and is intentionally excluded from Git.

## Legacy SQL migration

Copy the legacy dump temporarily to the VPS, for example:

```bash
cp /path/to/hrdynt_stepoil.sql /opt/dwm/legacy/hrdynt_stepoil.sql
```

Create `.env` first:

```bash
cp .env.example .env
```

Generate a strong session secret and put it in `.env`:

```bash
openssl rand -hex 64
```

Install dependencies and import the dump directly into SQLite:

```bash
npm install
npm run db:import -- legacy/hrdynt_stepoil.sql
npm run db:check
```

After a successful import, remove the temporary SQL dump:

```bash
rm -f legacy/hrdynt_stepoil.sql
```

No MySQL server or `mysql` command is required.

Laravel runtime tables (`cache`, `cache_locks`, `migrations`, and `sessions`) are intentionally not migrated because DWM does not use them. Business tables and their data are migrated.

## Run

```bash
npm start
```

Health check:

```bash
curl http://127.0.0.1:3020/health
```

Production:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

## Security

- Existing Laravel bcrypt hashes remain usable.
- MASTER/Supervisor have global project access.
- Operator/Staff are restricted to their assigned project.
- CSRF and login rate limiting are enabled.
- `.env`, SQLite database files, SQL dumps, uploads, and temporary files are excluded from Git.


## Backup SQLite

Create a consistent SQLite backup without stopping DWM:

```bash
npm run db:backup
```

Backups are written to `backups/` and excluded from Git.

## DWM v0.3 management phase

v0.3 adds server-enforced Account and Project management plus a lightweight Daily Report overview.

Authorization rules:

- `MASTER`: all projects, project management, account management.
- `Supervisor`: all projects and project management.
- `Operator`: assigned project only.
- `Staff`: assigned project only.

Project creation is transactional and creates the initial daily report plus the linked report records. State-changing actions use POST + CSRF protection rather than destructive GET routes.

After replacing source on the VPS:

```bash
cd /opt/dwm
npm install
pm2 restart dwm --update-env
curl https://dwm.logisourcedigital.web.id/health
```

The expected health response reports `version: "0.3.0"`.
