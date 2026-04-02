const crypto = require('crypto');

// Genera un token por sesión y lo expone en res.locals
function csrf(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

// Verifica el token en cada POST/PUT/DELETE
function verifyCsrf(req, res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const token = req.body._csrf;
    if (!token || token !== req.session.csrfToken) {
      const err = new Error('Token CSRF inválido. Recarga la página e intenta de nuevo.');
      err.status = 403;
      return next(err);
    }
  }
  next();
}

module.exports = { csrf, verifyCsrf };
