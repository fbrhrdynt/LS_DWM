import crypto from 'node:crypto';

function verify(req, expected) {
  const supplied = req.body?._csrf || req.get('x-csrf-token');
  if (!supplied || !expected) return false;

  const a = Buffer.from(String(supplied));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function csrfToken(req, res, next) {
  if (!req.session) req.session = {};

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  res.locals.csrfToken = req.session.csrfToken;

  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Multipart bodies are parsed by Multer at route-level. Defer verification
  // until after Multer has populated req.body, then use verifyMultipartCsrf.
  if (req.is('multipart/form-data')) {
    req.deferredCsrf = true;
    return next();
  }

  if (!verify(req, req.session.csrfToken)) {
    return res.status(419).send('CSRF token mismatch');
  }

  next();
}

export function verifyMultipartCsrf(req, res, next) {
  if (!req.deferredCsrf || !verify(req, req.session?.csrfToken)) {
    return res.status(419).send('CSRF token mismatch');
  }
  next();
}
