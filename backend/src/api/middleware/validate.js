// middleware/validate.js
// Zod request validation middleware.

const { fail } = require('./respond');

/**
 * validate(schema, source?)
 * Validates req[source] against a Zod schema.
 * On success:  req[source] is replaced with the parsed (coerced) value.
 * On failure:  responds 400 with { success: false, error, details: [{path, message}] }
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path:    i.path.join('.'),
        message: i.message,
      }));
      return fail(res, 'Validation failed', 400, details);
    }
    req[source] = result.data;
    return next();
  };
}

module.exports = { validate };
