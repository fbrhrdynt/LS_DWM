# DWM Exports

## Daily Report PDF

Routes:

- `GET /projects/:projectId/reports/:wellId/pdf`
- `GET /projects/:projectId/reports/:wellId/pdf?download=1`

The PDF is generated server-side using PDFKit. It does not require Chart.js,
a CDN, Chromium, Puppeteer, or browser-side screenshot generation.

Included sections:

- Well information
- Active mud properties
- Centrifuges and shale shakers
- Cutting dryers
- Desander / Desilter
- Retort worksheet
- Oil-on-Cuttings chart
- Recovery totals
- Daily waste
- Cuttings by-passed
- Personnel
- Rig / other activity
- DWM activity

## Excel Well Summary

Route:

- `GET /projects/:projectId/summary.xlsx`

The workbook retains the 90-column legacy Well Summary structure.

Improvements over the legacy mapping:

- Active System Vol uses `activesysvol`.
- To Dryer uses `vctodryer_bbls`.
- From Dryer uses `vcfrdryer_bbls`.
- The header is frozen.
- AutoFilter is enabled.
- Header text wraps.
- No browser-side Excel library is loaded.

Both export types apply normal project authorization before any file is generated.
