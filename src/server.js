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
import { pingDatabase } from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

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

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
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

app.use(cookieSession({
  name: 'dwm.sid',
  keys: [process.env.SESSION_SECRET],
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 2 * 60 * 60 * 1000
}));

app.use(loadUser);
app.use(csrfToken);

app.use((req, res, next) => {
  res.locals.appName = process.env.APP_NAME || 'DWM';
  res.locals.currentPath = req.path;
  next();
});

app.get('/', (req, res) => {
  res.redirect(req.user ? '/dashboard' : '/login');
});

app.get('/health', (req, res) => {
  try {
    res.json({ ok: true, db: pingDatabase(), database: 'sqlite', app: 'DWM' });
  } catch {
    res.status(503).json({ ok: false, db: false, database: 'sqlite', app: 'DWM' });
  }
});

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(projectRoutes);

app.use(notFound);
app.use(errorHandler);

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3020);

app.listen(port, host, () => {
  console.log(`DWM listening on http://${host}:${port}`);
});
