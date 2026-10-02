# DWM v0.8.6.1

PDF 502 hotfix.

- Fixes `ReferenceError: water is not defined` in Active Mud PDF rendering.
- Keeps the legacy fluid-category mapping introduced in v0.8.6.
- Delays piping the PDF response until synchronous rendering completes, so future render exceptions return a normal application error instead of a broken upstream / Nginx 502.
- Adds a regression guard to `npm run pdf:check`.
