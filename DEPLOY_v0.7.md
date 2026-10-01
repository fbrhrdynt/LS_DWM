# Deploy DWM v0.7

```bash
cd /opt/dwm

npm run backup:full

unzip -o DWM-v0.7-Security-Audit.zip
npm install

npm run security:check
npm run report:check
npm run export:check
npm run formula:check
npm run maintenance:check
npm run check
npm run db:check

pm2 restart dwm --update-env
curl https://dwm.logisourcedigital.web.id/health
```

Optional SMTP values should be added to `/opt/dwm/.env` before restarting PM2.

The expected health version is `0.7.0`.
