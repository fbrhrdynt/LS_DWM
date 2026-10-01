export function notFound(req, res) {
  res.status(404).render('errors/404', { title: 'Page not found' });
}

export function errorHandler(error, req, res, next) {
  console.error(error);

  if (error?.name === 'MulterError' || String(error?.message || '').startsWith('Unsupported file type:')) {
    return res.status(400).render('errors/400', { title: error.message || 'Upload rejected' });
  }

  if (res.headersSent) return next(error);

  res.status(500).render('errors/500', {
    title: 'Server error',
    errorId: Date.now().toString(36)
  });
}
