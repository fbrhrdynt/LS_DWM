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


## v0.4 Daily Report editor

DWM v0.4 adds a server-rendered editable daily-report workflow while keeping the client payload small.

Available report sections include report information, well data, active mud properties, shakers, centrifuges, cutting dryers, desander, desilter, cuttings by-passed, waste/activity, personnel, and retort/finalize values.

Report edits are project-scoped on the server. Locked reports cannot be modified until they are unlocked with the project access code. Unlock attempts are rate limited.

Copying a report creates the next report number and clones linked report tables inside one SQLite transaction.

After deployment:

```bash
npm run check
npm run db:check
pm2 restart dwm --update-env
curl https://dwm.logisourcedigital.web.id/health
```

The expected health version is `0.4.0`.


## Automatic report calculations

DWM v0.4.1 restores the legacy Daily Report formulas. Calculated fields update live in the report editor and are recalculated server-side before saving. See `FORMULAS.md` for the formula reference.

Validate formulas after deployment:

```bash
npm run formula:check
```


## v0.5 Assets, Inspection and Preventive Maintenance

DWM v0.5 ports the legacy asset-management modules without exposing raw file paths.

Included:

- Asset CRUD and COC files
- Inspection categories, records, certificates and due/expired status
- Preventive-maintenance categories and history
- Automatic PM due date: `PM Start + Category Frequency`
- PM document/equipment categories and document library
- Dashboard PM/inspection due counters
- Secure multipart upload with CSRF verification

Uploads are stored under `storage/uploads/` and remain excluded from Git. Database rows store only relative managed paths.

After deployment run:

```bash
npm install
npm run maintenance:check
npm run formula:check
npm run check
npm run db:check
pm2 restart dwm --update-env
```

The expected health version is `0.5.0`.


## v0.5.1 UI update

- Manual Light and Dark mode.
- Theme preference is stored in the browser and persists after refresh/login.
- Retort editor restored to the original horizontal worksheet pattern:
  Parameter × Shaker Overflow × Cutting Dryer × Centrifuge 1 × Centrifuge 2 × Centrifuge 3.
- Retort automatic formulas remain active in the browser and are revalidated on the server.
- Horizontal scrolling is intentionally retained on mobile instead of converting the Retort worksheet into stacked sections.


## v0.6 exports

DWM now generates the Daily Report PDF and 90-column Well Summary Excel file server-side.

```text
GET /projects/:projectId/reports/:wellId/pdf
GET /projects/:projectId/reports/:wellId/pdf?download=1
GET /projects/:projectId/summary.xlsx
```

PDF generation uses PDFKit and the OOC chart is drawn directly in the PDF.
Excel generation uses ExcelJS. Neither feature adds a heavy browser bundle.
