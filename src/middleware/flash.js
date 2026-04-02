// Middleware de mensajes flash basado en sesión
module.exports = function flash(req, res, next) {
  res.locals.flash = req.session.flash || {};
  delete req.session.flash;

  req.flash = (type, msg) => {
    req.session.flash = req.session.flash || {};
    req.session.flash[type] = msg;
  };

  next();
};
