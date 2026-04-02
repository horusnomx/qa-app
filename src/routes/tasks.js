const express  = require('express');
const db       = require('../db');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_STATUSES = ['pending', 'in_progress', 'done'];
const VALID_LIMITS   = [5, 10, 20, 50];

// ── Lista con paginación, búsqueda y filtro ───────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = VALID_LIMITS.includes(parseInt(req.query.limit)) ? parseInt(req.query.limit) : 10;
  const search = (req.query.search || '').trim();
  const status = VALID_STATUSES.includes(req.query.status) ? req.query.status : '';
  const offset = (page - 1) * limit;

  let where  = 'WHERE user_id = ?';
  const params = [req.session.userId];

  if (search) { where += ' AND title LIKE ?';  params.push(`%${search}%`); }
  if (status) { where += ' AND status = ?';    params.push(status); }

  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM tasks ${where}`).get(...params);
  const tasks     = db.prepare(`SELECT * FROM tasks ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  const totalPages = Math.ceil(total / limit) || 1;

  res.render('tasks/index', {
    tasks,
    username: req.session.username,
    pagination: { page, limit, total, totalPages },
    filters: { search, status }
  });
});

// ── Nueva tarea ───────────────────────────────────────────────────────────────
router.get('/new', requireAuth, (req, res) => {
  res.render('tasks/form', { task: null, errors: [] });
});

router.post('/', requireAuth, (req, res) => {
  const errors = validate.task(req.body);
  if (errors.length) return res.render('tasks/form', { task: null, errors });

  const { title, description, status } = req.body;
  db.prepare('INSERT INTO tasks (user_id, title, description, status) VALUES (?, ?, ?, ?)').run(
    req.session.userId, title.trim(), (description || '').trim(), status || 'pending'
  );

  req.flash('success', 'Tarea creada correctamente.');
  res.redirect('/tasks');
});

// ── Editar tarea ──────────────────────────────────────────────────────────────
router.get('/:id/edit', requireAuth, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!task) return res.redirect('/tasks');
  res.render('tasks/form', { task, errors: [] });
});

router.post('/:id/edit', requireAuth, (req, res) => {
  const errors = validate.task(req.body);
  if (errors.length) {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    return res.render('tasks/form', { task, errors });
  }

  const { title, description, status } = req.body;
  db.prepare('UPDATE tasks SET title = ?, description = ?, status = ? WHERE id = ? AND user_id = ?').run(
    title.trim(), (description || '').trim(), status, req.params.id, req.session.userId
  );

  req.flash('success', 'Tarea actualizada correctamente.');
  res.redirect('/tasks');
});

// ── Cambio de estado inline ───────────────────────────────────────────────────
router.post('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    req.flash('error', 'Estado inválido.');
    return res.redirect('/tasks');
  }

  db.prepare('UPDATE tasks SET status = ? WHERE id = ? AND user_id = ?').run(status, req.params.id, req.session.userId);
  req.flash('success', 'Estado actualizado.');

  // Devolver a la misma página con los mismos filtros
  const back = req.get('Referer') || '/tasks';
  res.redirect(back);
});

// ── Eliminar tarea ────────────────────────────────────────────────────────────
router.post('/:id/delete', requireAuth, (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  req.flash('success', 'Tarea eliminada.');
  res.redirect('/tasks');
});

module.exports = router;
