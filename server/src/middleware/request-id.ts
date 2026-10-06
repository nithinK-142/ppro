import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const validRequestId = /^[A-Za-z0-9._-]{1,128}$/;

const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get('X-Request-Id');
  const id = incoming && validRequestId.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};

export default requestId;
