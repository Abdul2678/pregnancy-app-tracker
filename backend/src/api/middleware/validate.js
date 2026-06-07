// api/middleware/validate.js
// Zod request validation helper.

/**
 * validate(schema, source) — returns middleware validating req[source] against a
 * Zod schema. On success, the parsed value replaces req[source]. On failure,
 * responds 400 with the issues.
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req[source] = result.data;
    return next();
  };
}

module.exports = { validate };
