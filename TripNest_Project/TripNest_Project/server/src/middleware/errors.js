function notFound(req, res) {
  return res.status(404).json({ error: 'Route not found.' });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const diagnostic = { name: error && error.name ? error.name : 'Error' };
  if (error && typeof error.code === 'string') diagnostic.code = error.code;
  console.error('Request failed:', diagnostic);
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  return res.status(500).json({ error: 'An unexpected server error occurred.' });
}

module.exports = { notFound, errorHandler };
