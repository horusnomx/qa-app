const db = require('../db');

const ROLE_LEVEL = { viewer: 1, member: 2, admin: 3, owner: 4 };

/**
 * Carga el proyecto y la membresía del usuario actual.
 * Adjunta req.project y req.memberRole.
 * Usa req.params.projectId o req.params.id como fallback.
 */
function loadProject(req, res, next) {
  const pid = req.params.projectId || req.params.id;
  if (!pid) return next();

  const row = db.prepare(`
    SELECT p.*, pm.role AS member_role
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id
    WHERE p.id = ? AND pm.user_id = ?
  `).get(pid, req.session.userId);

  if (!row) {
    const err = new Error('Proyecto no encontrado o sin acceso.');
    err.status = 404;
    return next(err);
  }

  req.project    = row;
  req.memberRole = row.member_role;
  next();
}

/**
 * Factory: requiere al menos el nivel de rol indicado.
 * Uso: requireRole('admin')  →  admin u owner pueden pasar.
 */
function requireRole(minRole) {
  return (req, res, next) => {
    const userLevel = ROLE_LEVEL[req.memberRole] || 0;
    const required  = ROLE_LEVEL[minRole] || 99;
    if (userLevel < required) {
      const err = new Error('No tienes permisos suficientes para esta acción.');
      err.status = 403;
      return next(err);
    }
    next();
  };
}

module.exports = { loadProject, requireRole };
