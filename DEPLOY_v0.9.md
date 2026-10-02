# Deploy DWM v0.9

```bash
cd /opt/dwm
npm run backup:full
unzip -o DWM-v0.9-Report-Asset-Workflow.zip
npm run v09:cleanup
npm install
npm run workflow:check
npm run formula:check
npm run pdf:check
npm run check
npm run db:check
pm2 restart dwm --update-env
curl https://dwm.logisourcedigital.web.id/health
```

Expected version: `0.9.0`.

After browser testing:

```bash
git add -A
git commit -m "Release DWM v0.9 report validation and simple assets"
git push
npm run cleanup:release
```


## v0.9.1 handover workflow correction

Validated reports remain visible to Operators and their PDF can still be viewed/downloaded. Validation only freezes Operator editing for crew handover. Supervisor/Admin can always view/edit and may re-open Operator editing when required.
