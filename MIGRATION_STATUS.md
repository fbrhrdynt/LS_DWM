# DWM Migration Status — v0.9.0

The Laravel rewrite is now intentionally scoped to **DWM Reports + Assets**.

## Active modules

- Authentication / Accounts
- Project / Job management
- DWM Daily Reports
- Report calculations
- PDF Daily Report
- Excel Well Summary (Supervisor/Admin)
- Simple Assets assigned directly to Project / Job
- PDF branding / settings
- Audit, backup and system administration

## Report workflow

- Operator accounts are assigned to exactly one Project.
- Operator saves mark a report **Pending validation**.
- Supervisor/Admin validates the report.
- Validated reports are closed to Operator access.
- Supervisor/Admin can re-open a validated report for Operator editing.
- Supervisor/Admin can always open/edit validated reports and their saves are auto-validated.
- The blank initial report created with a new Project remains Draft until its first save.

## Retired application features

- Maintenance UI/routes
- Inspection UI/routes
- Notification center
- Report access-code / unlock-code workflow

Legacy Maintenance/Inspection database tables are intentionally not dropped during upgrade so historical data is not destroyed. They are no longer part of the active DWM application.

## v0.9 PDF

The Retort worksheet uses the same major vertical guides as the Centrifuge table above it for a cleaner single-page report.
