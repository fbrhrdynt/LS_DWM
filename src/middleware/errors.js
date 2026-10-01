export function notFound(req, res) {
  res.status(404).render('errors/404', { title: 'Page not found' });
}

export function errorHandler(error, req, res, next) {
  console.error(error);

  if (res.headersSent) return next(error);

  res.status(500).render('errors/500', {
    title: 'Server error',
    errorId: Date.now().toString(36)
  });
}
