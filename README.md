# DWM

DWM is a lightweight Node.js + Express + EJS + SQLite application for operational Daily Reports and project-linked Assets.

## Current operational scope

### DWM Reports

- Project / Job based Daily Reports
- Well information, Active Mud Properties and equipment data
- Shakers, Centrifuges, Cutting Dryers, Desander/Desilter
- Horizontal Retort worksheet
- By-Passed, Daily Waste, Activities and Personnel
- Automatic browser + server calculations
- PDF Daily Report with configurable branding
- Excel Well Summary for Supervisor/Admin
- Operator → Supervisor/Admin validation workflow

### Assets

Assets are intentionally simple:

- Asset name
- Asset number
- Manufacturer serial number
- Status
- Notes
- Assigned Project / Job

An Operator only sees Assets belonging to their assigned Project.

## Roles

- **Admin** (`MASTER` internally): global access, Accounts, Projects, Settings, validation.
- **Supervisor**: global Project/Report/Asset access and report validation.
- **Operator**: exactly one assigned Project; cannot access another Project.

When an Operator saves a report it becomes **Pending validation**. After Supervisor/Admin validation it becomes **Validated** and Operators cannot open it until a Supervisor/Admin re-opens it. Supervisor/Admin-created or saved reports validate automatically.

## Retired features

Maintenance, Inspection, notification-center and report access-code features are removed from the application as of v0.9. Historical legacy tables are retained only to avoid destructive migration.

## Production

- Node.js 22+
- SQLite via `node:sqlite`
- PM2
- Nginx reverse proxy
- Default local bind: `127.0.0.1:3020`

See `DEPLOY_v0.9.md`, `RELEASE_0.9.md`, `FORMULAS.md`, `EXPORTS.md` and `SECURITY.md`.


## v0.9.1 handover workflow correction

Validated reports remain visible to Operators and their PDF can still be viewed/downloaded. Validation only freezes Operator editing for crew handover. Supervisor/Admin can always view/edit and may re-open Operator editing when required.
