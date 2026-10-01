import crypto from 'node:crypto';

export function csrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  res.locals.csrfToken = req.session.csrfToken;

  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const supplied = req.body?._csrf || req.get('x-csrf-token');
  const expected = req.session.csrfToken;

  if (!supplied || !expected) {
    return res.status(419).send('CSRF token mismatch');
  }

  const a = Buffer.from(String(supplied));
  const b = Buffer.from(String(expected));

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(419).send('CSRF token mismatch');
  }

  next();
}
