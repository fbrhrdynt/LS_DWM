import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import mysqlSessionFactory from 'express-mysql-session';
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

app.use(compression({
  threshold: 512
}));

app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use(express.json({ limit: '256kb' }));

app.use('/static', express.static(path.join(rootDir, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  immutable: process.env.NODE_ENV === 'production',
  etag: true,
  lastModified: true
}));

const MySQLStore = mysqlSessionFactory(session);
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  createDatabaseTable: true,
  schema: {
    tableName: 'dwm_sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
});

app.use(session({
  name: 'dwm.sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 2 * 60 * 60 * 1000
  }
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

app.get('/health', async (req, res) => {
  try {
    const db = await pingDatabase();
    res.json({ ok: true, db, app: 'DWM' });
  } catch {
    res.status(503).json({ ok: false, db: false, app: 'DWM' });
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
