# DWM v0.9.0 — Report + Asset Workflow

DWM is intentionally simplified to two operational modules:

- DWM Reports
- Assets

Accounts and Settings remain as administration modules.

## Removed from the application

- Maintenance UI/routes
- Inspection UI/routes
- Notification center
- Report access code / unlock code

The upgrade does not drop legacy PM/Inspection database tables, so historical data is not destructively removed.

## Asset workflow

Assets now contain only core asset data and one direct Project / Job assignment. An Operator sees only assets assigned to the same Project as their account.

## Operator project isolation

Operator accounts are assigned to exactly one Project. Changing the assignment takes effect immediately on the next request because authorization reads the current `xusers.id_project` value from SQLite; the previous Project becomes inaccessible.

## Report validation workflow

### Operator

1. Opens the Draft report or creates the next report.
2. Saves report data.
3. Every save changes the report to `PENDING`.
4. Supervisor/Admin reviews and clicks **Validate**.
5. The report becomes `VALIDATED` and all Operator accounts are blocked from opening/editing/PDF access for that report.
6. Supervisor/Admin can click **Re-open** to return it to Draft for Operator corrections.

### Supervisor / Admin

- Can always open validated reports.
- Can validate Draft/Pending reports directly from the report list or report overview.
- Can re-open validated reports for Operators.
- Reports created with **Create next report** by Supervisor/Admin are validated automatically.
- Any report save by Supervisor/Admin is validated automatically.
- No access code is used.

The blank Report 1 created automatically with a new Project is only a Draft placeholder. The first user who saves it becomes its creator; an Operator save makes it Pending, while a Supervisor/Admin save validates it automatically.

## PDF alignment

Retort uses the same main vertical guides as the Centrifuge table above:

- parameter boundary: 24.2%
- subsequent guides: 33.4%, 42.6%, 52.6%, 62.6%
- Retort side panel begins at 72.2%

This removes the visible 0.4–0.8% drift from the previous PDF layout.


## v0.9.1 handover workflow correction

Validated reports remain visible to Operators and their PDF can still be viewed/downloaded. Validation only freezes Operator editing for crew handover. Supervisor/Admin can always view/edit and may re-open Operator editing when required.
