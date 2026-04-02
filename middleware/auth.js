// middleware/auth.js
// Verifica que el request incluya un token JWT válido en el header Authorization.
// Si el token es válido, adjunta el payload decodificado en req.usuario.

const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
  // El header debe tener el formato: Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      mensaje: 'Acceso denegado. Se requiere token de autenticación.'
    });
  }

  const token = authHeader.split(' ')[1]; // extraer solo el token sin "Bearer "

  try {
    // Verificar firma y expiración del token
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { id, email, nombre }
    next();
  } catch (err) {
    // El token expiró o fue manipulado
    return res.status(401).json({
      mensaje: 'Token inválido o expirado.'
    });
  }
}

module.exports = { verificarToken };
