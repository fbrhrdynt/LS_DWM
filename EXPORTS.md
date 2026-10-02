# DWM Exports — v0.9

## Daily Report PDF

- `GET /projects/:projectId/reports/:wellId/pdf`
- `GET /projects/:projectId/reports/:wellId/pdf?download=1`

PDF access follows report validation rules. Operators cannot render a validated report until Supervisor/Admin re-opens it. Supervisor/Admin can always render it.

The PDF is generated server-side and preserves the compact A4 portrait report layout.

## Excel Well Summary

- `GET /projects/:projectId/summary.xlsx`

Excel Well Summary is restricted to Supervisor/Admin in v0.9 because it aggregates reports that may already be validated and closed to Operators.
