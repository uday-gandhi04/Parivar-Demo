/**
 * Express 5 supports async error propagation natively, so any handler can
 * `throw` an Error (optionally with .status / .code) and it will land here.
 */
export function errorHandler(err, req, res, _next) {
  const status = err.status ?? err.statusCode ?? 500;
  const payload = { error: err.message ?? 'Internal server error' };
  if (err.code) payload.code = err.code;
  if (process.env.DEBUG) payload.stack = err.stack;
  if (status >= 500) console.error(err);
  res.status(status).json(payload);
}
