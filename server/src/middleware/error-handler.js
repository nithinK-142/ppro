const AppError = require('../errors/app-error');

function errorHandler(err, req, res, _next) {
  let error;

  if (err?.type === 'entity.too.large') {
    error = new AppError(413, 'REQUEST_TOO_LARGE', 'Request body is too large');
  } else if (err?.type === 'entity.parse.failed') {
    error = new AppError(400, 'INVALID_JSON', 'Request body must contain valid JSON');
  } else if (err instanceof AppError) {
    error = err;
  } else {
    error = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong');
  }

  if (error.status >= 500) {
    console.error(JSON.stringify({
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      error: err?.message
    }));
  }

  const body = {
    error: {
      code: error.code,
      message: error.message,
      requestId: req.requestId
    }
  };

  if (error.details) body.error.details = error.details;
  res.status(error.status).json(body);
}

module.exports = errorHandler;
