import type { RequestHandler } from 'express';
import { z } from 'zod';
import AppError from '../errors/app-error.ts';

type ValidationConfig = {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
};

const validate = ({ body, query, params }: ValidationConfig): RequestHandler => (req, _res, next) => {
  const sources = [
    ['body', body],
    ['query', query],
    ['params', params]
  ] as const;

  for (const [source, schema] of sources) {
    if (!schema) continue;
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', result.error.flatten().fieldErrors));
      return;
    }
    req[source] = result.data;
  }

  next();
};

export default validate;
