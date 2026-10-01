# Deploy DWM v0.8

```bash
cd /opt/dwm

# Existing v0.7 backup before overwrite
npm run backup:full

unzip -o DWM-v0.8-Release-Candidate.zip
npm install

# Safe checks
npm run release:check

# Optional: inspect/repair legacy consistency
npm run integrity:check
npm run integrity:repair
npm run integrity:repair -- --apply
npm run integrity:check

pm2 restart dwm --update-env
curl https://dwm.logisourcedigital.web.id/health
```

Expected version: `0.8.0`.

## Legacy Laravel files

Dry run first:

```bash
npm run legacy:files -- /path/to/old-laravel
```

Apply:

```bash
npm run legacy:files -- /path/to/old-laravel --apply
```

## Backup / verify / restore

```bash
npm run backup:full
npm run backup:verify -- backups/dwm-full-YYYY-MM-DD...

# Restore is intentionally dry-run first. Stop DWM before --apply.
npm run backup:restore -- backups/dwm-full-YYYY-MM-DD...
pm2 stop dwm
npm run backup:restore -- backups/dwm-full-YYYY-MM-DD... --apply
pm2 start dwm
```

## Optional WebDAV / ownCloud

Set `OWNCLOUD_BASE_URI`, `OWNCLOUD_USERNAME`, `OWNCLOUD_PASSWORD`, then:

```bash
npm run webdav:check
npm run webdav:backup
```

## Optional daily backup timer

Copy `deploy/dwm-backup.service.example` and `deploy/dwm-backup.timer.example` to `/etc/systemd/system/` without the `.example` suffix, adjust the Linux user if needed, then enable the timer.

## Optional legacy report renumber

Dry run only:

```bash
npm run reports:renumber -- PROJECT_ID
```

Apply only after reviewing the output:

```bash
npm run reports:renumber -- PROJECT_ID --apply
```
