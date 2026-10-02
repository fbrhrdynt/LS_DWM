# Deploy DWM v0.8.4

```bash
cd /opt/dwm
npm run backup:full
unzip -o DWM-v0.8.4-Final-Improvements.zip
npm install
npm run formula:check
npm run pdf:check
npm run release:check
pm2 restart dwm --update-env
curl https://dwm.logisourcedigital.web.id/health
```

Expected version: `0.8.4`.

After validation, commit/push and remove old ZIP artifacts from `/opt/dwm`.
