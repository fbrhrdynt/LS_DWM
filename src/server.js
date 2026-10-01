import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieSession from 'cookie-session';
import helmet from 'helmet';
import compression from 'compression';

import { loadUser } from './middleware/auth.js';
import { csrfToken } from './middleware/csrf.js';
import { notFound, errorHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import projectRoutes from './routes/project.routes.js';
import accountRoutes from './routes/account.routes.js';
import reportRoutes from './routes/report.routes.js';
import assetMaintenanceRoutes from './routes/asset-maintenance.routes.js';
import exportRoutes from './routes/export.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import auditRoutes from './routes/audit.routes.js';
import { auditMutations } from './middleware/audit.js';
import { loadNotificationSummary } from './middleware/notifications.js';
import notificationRoutes from './routes/notification.routes.js';
import systemRoutes from './routes/system.routes.js';
import legacyCompatRoutes from './routes/legacy-compat.routes.js';
import { formatReportNumber } from './services/report-sequence.js';
import { pingDatabase } from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const APP_VERSION = '0.8.0';

const app = express();

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be set and at least 32 characters long.');
}

if (Number(process.env.TRUST_PROXY || 0) > 0) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY));
}

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(rootDir, 'views'));
app.locals.appName = process.env.APP_NAME || 'DWM';
app.locals.assetVersion = APP_VERSION;
app.locals.formatReportNo = formatReportNumber;

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  referrerPolicy: { policy: 'no-referrer' }
}));

app.use(compression({ threshold: 512 }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use(express.json({ limit: '256kb' }));

app.use('/static', express.static(path.join(rootDir, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  immutable: process.env.NODE_ENV === 'production',
  etag: true,
  lastModified: true
}));

const sessionKeys = [
  process.env.SESSION_SECRET,
  process.env.SESSION_SECRET_PREVIOUS
].filter(Boolean);

const sessionHours = Math.min(
  24,
  Math.max(1, Number(process.env.SESSION_MAX_HOURS || 8))
);

app.use(cookieSession({
  name: 'dwm.sid',
  keys: sessionKeys,
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: sessionHours * 60 * 60 * 1000
}));

app.use(loadUser);
app.use(loadNotificationSummary);
app.use(csrfToken);
app.use(auditMutations);

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

app.get('/', (req, res) => {
  res.redirect(req.user ? '/dashboard' : '/login');
});

app.get('/health', (req, res) => {
  try {
    const dbOk = pingDatabase();
    res.status(dbOk ? 200 : 503).json({
      ok: dbOk,
      db: dbOk,
      database: 'sqlite',
      app: 'DWM',
      version: APP_VERSION,
      uptime_seconds: Math.floor(process.uptime())
    });
  } catch {
    res.status(503).json({
      ok: false,
      db: false,
      database: 'sqlite',
      app: 'DWM',
      version: APP_VERSION,
      uptime_seconds: Math.floor(process.uptime())
    });
  }
});

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(projectRoutes);
app.use(accountRoutes);
app.use(reportRoutes);
app.use(assetMaintenanceRoutes);
app.use(exportRoutes);
app.use(settingsRoutes);
app.use(auditRoutes);
app.use(notificationRoutes);
app.use(systemRoutes);
app.use(legacyCompatRoutes);

app.use(notFound);
app.use(errorHandler);

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3020);

app.listen(port, host, () => {
  console.log(`DWM v${APP_VERSION} listening on http://${host}:${port}`);
});
