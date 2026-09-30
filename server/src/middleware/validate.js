const AppError = require('../errors/app-error');

function validate({ body, query, params }) {
  return (req, _res, next) => {
    for (const [source, schema] of [['body', body], ['query', query], ['params', params]]) {
      if (!schema) continue;
      const result = schema.safeParse(req[source]);
      if (!result.success) {
        return next(new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', result.error.flatten().fieldErrors));
      }
      req[source] = result.data;
    }
    return next();
  };
}

module.exports = validate;
