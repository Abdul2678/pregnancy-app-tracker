// middleware/respond.js
// Consistent response helpers — every handler uses these, never res.json directly.

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function created(res, data) {
  return ok(res, data, 201);
}

function fail(res, message, status = 400, details = undefined) {
  const body = { success: false, error: message };
  if (details !== undefined) body.details = details;
  return res.status(status).json(body);
}

function notFound(res, entity = 'Resource') {
  return fail(res, `${entity} not found`, 404);
}

function forbidden(res) {
  return fail(res, 'Forbidden', 403);
}

module.exports = { ok, created, fail, notFound, forbidden };
