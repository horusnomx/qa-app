const express  = require('express');
const db       = require('../db');
const validate = require('../middleware/validate');
const { requireAuth }              = require('../middleware/auth');
const { loadProject, requireRole } = require('../middleware/projectAccess');

const router = express.Router();
router.use(requireAuth);

// ── helpers ──────────────────────────────────────────────────────────────────
function getIssueLabelsMap(issues) {
  if (!issues.length) return {};
  const ids = issues.map(i => i.id);
  const ph  = ids.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT il.issue_id, l.* FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE il.issue_id IN (${ph})`
  ).all(...ids);
  const map = {};
  rows.forEach(r => { (map[r.issue_id] = map[r.issue_id] || []).push(r); });
  return map;
}

// ── Lista de proyectos ────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const projects = db.prepare(`
    SELECT p.*, pm.role,
      (SELECT COUNT(*) FROM issues i WHERE i.project_id = p.id AND i.status != 'done') AS open_issues,
      (SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.id) AS member_count
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id
    WHERE pm.user_id = ?
    ORDER BY p.created_at DESC
  `).all(req.session.userId);

  res.render('projects/index', { projects });
});

// ── Nuevo proyecto ────────────────────────────────────────────────────────────
router.get('/new', (req, res) => {
  res.render('projects/new', { errors: [], old: {} });
});

router.post('/', (req, res) => {
  let { name, key, description } = req.body;
  key = (key || '').toUpperCase().replace(/[^A-Z]/g, '');

  const errors = validate.project({ name, key });
  if (errors.length) return res.render('projects/new', { errors, old: req.body });

  const existing = db.prepare('SELECT id FROM projects WHERE key = ?').get(key);
  if (existing) return res.render('projects/new', { errors: [`La clave "${key}" ya está en uso.`], old: req.body });

  const { lastInsertRowid } = db.prepare(
    'INSERT INTO projects (key, name, description, owner_id) VALUES (?, ?, ?, ?)'
  ).run(key, name.trim(), (description || '').trim(), req.session.userId);

  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(lastInsertRowid, req.session.userId, 'owner');

  req.flash('success', `Proyecto "${name}" creado.`);
  res.redirect(`/projects/${lastInsertRowid}/board`);
});

// ── Rutas de proyecto individual ──────────────────────────────────────────────
router.use('/:id', loadProject);

router.get('/:id', (req, res) => res.redirect(`/projects/${req.params.id}/board`));

// ── Board (Kanban) ────────────────────────────────────────────────────────────
router.get('/:id/board', (req, res) => {
  const p = req.project;
  const sprintId = req.query.sprint || '';

  let where = 'i.project_id = ? AND i.status != \'backlog\'';
  const params = [p.id];
  if (sprintId) { where += ' AND i.sprint_id = ?'; params.push(sprintId); }

  const issues = db.prepare(`
    SELECT i.*, u.username AS assignee_name, s.name AS sprint_name
    FROM issues i
    LEFT JOIN users u ON u.id = i.assignee_id
    LEFT JOIN sprints s ON s.id = i.sprint_id
    WHERE ${where}
    ORDER BY i.priority DESC, i.number ASC
  `).all(...params);

  const labelsMap = getIssueLabelsMap(issues);
  const sprints   = db.prepare('SELECT * FROM sprints WHERE project_id = ? AND status != \'completed\' ORDER BY created_at').all(p.id);
  const activeSprint = sprints.find(s => s.status === 'active');

  res.render('projects/board', {
    project: p, memberRole: req.memberRole,
    issues, labelsMap, sprints, activeSprint,
    filterSprint: sprintId
  });
});

// Cambio de estado desde el board
router.post('/:id/board/move', (req, res) => {
  const { issue_id, status } = req.body;
  const VALID = ['backlog','todo','in_progress','in_review','done'];
  if (!VALID.includes(status)) { req.flash('error', 'Estado inválido.'); return res.redirect('back'); }
  db.prepare('UPDATE issues SET status = ?, updated_at = datetime(\'now\') WHERE id = ? AND project_id = ?').run(status, issue_id, req.params.id);
  res.redirect(`/projects/${req.params.id}/board${req.query.sprint ? '?sprint=' + req.query.sprint : ''}`);
});

// ── Backlog ───────────────────────────────────────────────────────────────────
router.get('/:id/backlog', (req, res) => {
  const p = req.project;
  const sprints = db.prepare('SELECT * FROM sprints WHERE project_id = ? AND status != \'completed\' ORDER BY status DESC, created_at ASC').all(p.id);

  const backlogIssues = db.prepare(`
    SELECT i.*, u.username AS assignee_name
    FROM issues i
    LEFT JOIN users u ON u.id = i.assignee_id
    WHERE i.project_id = ? AND i.status = 'backlog'
    ORDER BY i.number ASC
  `).all(p.id);

  // Issues por sprint (solo planning/active)
  const sprintIssues = {};
  sprints.forEach(s => {
    sprintIssues[s.id] = db.prepare(`
      SELECT i.*, u.username AS assignee_name
      FROM issues i
      LEFT JOIN users u ON u.id = i.assignee_id
      WHERE i.project_id = ? AND i.sprint_id = ?
      ORDER BY i.number ASC
    `).all(p.id, s.id);
  });

  res.render('projects/backlog', { project: p, memberRole: req.memberRole, sprints, backlogIssues, sprintIssues });
});

// Asignar issue a sprint desde backlog
router.post('/:id/backlog/assign', requireRole('member'), (req, res) => {
  const { issue_id, sprint_id } = req.body;
  const sprint = sprint_id ? db.prepare('SELECT id FROM sprints WHERE id = ? AND project_id = ?').get(sprint_id, req.params.id) : null;
  if (sprint_id && !sprint) { req.flash('error', 'Sprint no encontrado.'); return res.redirect('back'); }
  db.prepare('UPDATE issues SET sprint_id = ?, updated_at = datetime(\'now\') WHERE id = ? AND project_id = ?').run(sprint_id || null, issue_id, req.params.id);
  res.redirect(`/projects/${req.params.id}/backlog`);
});

// ── Settings redirect ─────────────────────────────────────────────────────────
router.get('/:id/settings', requireRole('admin'), (req, res) => {
  res.redirect(`/projects/${req.params.id}/settings/members`);
});

// ── Settings: Members ─────────────────────────────────────────────────────────
router.get('/:id/settings/members', requireRole('admin'), (req, res) => {
  const members = db.prepare(`
    SELECT pm.*, u.username, u.email
    FROM project_members pm JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ? ORDER BY pm.joined_at ASC
  `).all(req.params.id);
  res.render('settings/members', { project: req.project, memberRole: req.memberRole, members, errors: [] });
});

router.post('/:id/settings/members/invite', requireRole('admin'), (req, res) => {
  const { email, role } = req.body;
  const errors = validate.memberRole({ role });
  if (errors.length) {
    const members = db.prepare('SELECT pm.*, u.username, u.email FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ?').all(req.params.id);
    return res.render('settings/members', { project: req.project, memberRole: req.memberRole, members, errors });
  }

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) {
    const members = db.prepare('SELECT pm.*, u.username, u.email FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ?').all(req.params.id);
    return res.render('settings/members', { project: req.project, memberRole: req.memberRole, members, errors: [`No existe ningún usuario con email "${email}".`] });
  }

  try {
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(req.params.id, user.id, role);
    req.flash('success', 'Miembro agregado.');
  } catch {
    req.flash('error', 'El usuario ya es miembro del proyecto.');
  }
  res.redirect(`/projects/${req.params.id}/settings/members`);
});

router.post('/:id/settings/members/:uid/role', requireRole('admin'), (req, res) => {
  const { role } = req.body;
  const errors = validate.memberRole({ role });
  if (errors.length) { req.flash('error', errors[0]); return res.redirect('back'); }
  // No se puede cambiar el rol del owner
  const target = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, req.params.uid);
  if (!target || target.role === 'owner') { req.flash('error', 'No se puede modificar el rol del owner.'); return res.redirect('back'); }
  db.prepare('UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?').run(role, req.params.id, req.params.uid);
  req.flash('success', 'Rol actualizado.');
  res.redirect(`/projects/${req.params.id}/settings/members`);
});

router.post('/:id/settings/members/:uid/remove', requireRole('admin'), (req, res) => {
  const target = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, req.params.uid);
  if (!target || target.role === 'owner') { req.flash('error', 'No se puede expulsar al owner.'); return res.redirect('back'); }
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.params.id, req.params.uid);
  req.flash('success', 'Miembro eliminado del proyecto.');
  res.redirect(`/projects/${req.params.id}/settings/members`);
});

// ── Settings: Labels ──────────────────────────────────────────────────────────
router.get('/:id/settings/labels', requireRole('admin'), (req, res) => {
  const labels = db.prepare('SELECT * FROM labels WHERE project_id = ? ORDER BY name').all(req.params.id);
  res.render('settings/labels', { project: req.project, memberRole: req.memberRole, labels, errors: [] });
});

router.post('/:id/settings/labels', requireRole('admin'), (req, res) => {
  const { name, color } = req.body;
  const errors = validate.label({ name, color });
  if (errors.length) {
    const labels = db.prepare('SELECT * FROM labels WHERE project_id = ? ORDER BY name').all(req.params.id);
    return res.render('settings/labels', { project: req.project, memberRole: req.memberRole, labels, errors });
  }
  try {
    db.prepare('INSERT INTO labels (project_id, name, color) VALUES (?, ?, ?)').run(req.params.id, name.trim(), color || '#6b8aff');
    req.flash('success', 'Etiqueta creada.');
  } catch {
    req.flash('error', 'Ya existe una etiqueta con ese nombre.');
  }
  res.redirect(`/projects/${req.params.id}/settings/labels`);
});

router.post('/:id/settings/labels/:lid/delete', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM labels WHERE id = ? AND project_id = ?').run(req.params.lid, req.params.id);
  req.flash('success', 'Etiqueta eliminada.');
  res.redirect(`/projects/${req.params.id}/settings/labels`);
});

// ── Settings: Sprints ─────────────────────────────────────────────────────────
router.get('/:id/settings/sprints', requireRole('admin'), (req, res) => {
  const sprints = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM issues i WHERE i.sprint_id = s.id) AS issue_count
    FROM sprints s WHERE s.project_id = ?
    ORDER BY s.status ASC, s.created_at DESC
  `).all(req.params.id);
  res.render('settings/sprints', { project: req.project, memberRole: req.memberRole, sprints, errors: [] });
});

router.post('/:id/settings/sprints', requireRole('admin'), (req, res) => {
  const { name, goal, start_date, end_date } = req.body;
  const errors = validate.sprint({ name });
  if (errors.length) {
    const sprints = db.prepare('SELECT s.*, (SELECT COUNT(*) FROM issues i WHERE i.sprint_id = s.id) AS issue_count FROM sprints s WHERE s.project_id = ? ORDER BY s.status ASC, s.created_at DESC').all(req.params.id);
    return res.render('settings/sprints', { project: req.project, memberRole: req.memberRole, sprints, errors });
  }
  db.prepare('INSERT INTO sprints (project_id, name, goal, start_date, end_date) VALUES (?, ?, ?, ?, ?)').run(
    req.params.id, name.trim(), (goal || '').trim(), start_date || null, end_date || null
  );
  req.flash('success', 'Sprint creado.');
  res.redirect(`/projects/${req.params.id}/settings/sprints`);
});

router.post('/:id/settings/sprints/:sid/start', requireRole('admin'), (req, res) => {
  const active = db.prepare('SELECT id FROM sprints WHERE project_id = ? AND status = \'active\'').get(req.params.id);
  if (active) { req.flash('error', 'Ya hay un sprint activo. Complétalo antes de iniciar otro.'); return res.redirect('back'); }
  db.prepare('UPDATE sprints SET status = \'active\' WHERE id = ? AND project_id = ?').run(req.params.sid, req.params.id);
  req.flash('success', 'Sprint iniciado.');
  res.redirect(`/projects/${req.params.id}/settings/sprints`);
});

router.post('/:id/settings/sprints/:sid/complete', requireRole('admin'), (req, res) => {
  // Mover issues no-done de vuelta al backlog
  db.prepare('UPDATE issues SET sprint_id = NULL, status = \'backlog\', updated_at = datetime(\'now\') WHERE sprint_id = ? AND status != \'done\'').run(req.params.sid);
  db.prepare('UPDATE sprints SET status = \'completed\' WHERE id = ? AND project_id = ?').run(req.params.sid, req.params.id);
  req.flash('success', 'Sprint completado. Los issues pendientes volvieron al backlog.');
  res.redirect(`/projects/${req.params.id}/settings/sprints`);
});

router.post('/:id/settings/sprints/:sid/delete', requireRole('admin'), (req, res) => {
  db.prepare('UPDATE issues SET sprint_id = NULL, updated_at = datetime(\'now\') WHERE sprint_id = ?').run(req.params.sid);
  db.prepare('DELETE FROM sprints WHERE id = ? AND project_id = ?').run(req.params.sid, req.params.id);
  req.flash('success', 'Sprint eliminado. Los issues fueron movidos al backlog.');
  res.redirect(`/projects/${req.params.id}/settings/sprints`);
});

// ── Eliminar proyecto ─────────────────────────────────────────────────────────
router.post('/:id/delete', requireRole('owner'), (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ? AND owner_id = ?').run(req.params.id, req.session.userId);
  req.flash('success', 'Proyecto eliminado.');
  res.redirect('/projects');
});

module.exports = router;
