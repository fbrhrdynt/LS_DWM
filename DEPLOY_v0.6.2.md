# DWM v0.6.2 deployment

```bash
cd /opt/dwm
npm run db:backup
unzip -o DWM-v0.6.2-PDF-Branding-CopyFix.zip
npm install
npm run report:check
npm run export:check
npm run formula:check
npm run maintenance:check
npm run check
npm run db:check
pm2 restart dwm --update-env
curl https://dwm.logisourcedigital.web.id/health
```

Expected health version: `0.6.2`.

After login as MASTER, open `Settings -> PDF report settings` to upload the left company logo, edit the report header, and upload a client logo for each project. Client logos can also be changed from `Projects -> Edit`.

Copy Report now uses the source report date + 1 calendar day and saves a whole-number report number.
