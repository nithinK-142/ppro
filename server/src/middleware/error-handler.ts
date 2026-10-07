import type { ErrorRequestHandler } from 'express';
import { z } from 'zod';
import AppError from '../utils/app-error.ts';

function hasErrorType(error: unknown, type: string): boolean {
  return typeof error === 'object' && error !== null && 'type' in error && error.type === type;
}

const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  let error: AppError;

  if (hasErrorType(err, 'entity.too.large')) {
    error = new AppError(413, 'REQUEST_TOO_LARGE', 'Request body is too large');
  } else if (hasErrorType(err, 'entity.parse.failed')) {
    error = new AppError(400, 'INVALID_JSON', 'Request body must contain valid JSON');
  } else if (err instanceof z.ZodError) {
    error = new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', z.flattenError(err).fieldErrors);
  } else if (err instanceof AppError) {
    error = err;
  } else {
    error = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong');
  }

  if (error.status >= 500) {
    req.log.error({ err, code: error.code, status: error.status, requestId: req.requestId }, 'request failed');
  } else if (error.status >= 400) {
    req.log.warn({ code: error.code, status: error.status, requestId: req.requestId }, 'request rejected');
  }

  const body: { error: { code: string; message: string; requestId?: string; details?: unknown } } = {
    error: {
      code: error.code,
      message: error.message,
      requestId: req.requestId
    }
  };

  if (error.details) body.error.details = error.details;
  res.status(error.status).json(body);
};

export default errorHandler;
