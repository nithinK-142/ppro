import type { RequestHandler } from 'express';
import { z } from 'zod';
import AppError from '../utils/app-error.ts';

const validate = (schema: z.ZodType): RequestHandler => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    next(new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', z.flattenError(result.error).fieldErrors));
    return;
  }

  req.body = result.data;
  next();
};

export default validate;
