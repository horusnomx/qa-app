// routes/tareas.js
// CRUD de tareas. Todas las rutas requieren token JWT válido.

const express            = require('express');
const supabase           = require('../database');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

// ── GET /api/tareas ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { status } = req.query;

  if (status && !['pendiente', 'completada'].includes(status)) {
    return res.status(400).json({
      mensaje: 'El filtro status solo acepta los valores: pendiente, completada.'
    });
  }

  let query = supabase
    .from('tareas')
    .select('*')
    .eq('usuario_id', req.usuario.id)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data: tareas, error } = await query;

  if (error) {
    console.error('Error al obtener tareas:', error.message);
    return res.status(500).json({ mensaje: 'Error al obtener las tareas.' });
  }

  res.status(200).json({ total: tareas.length, tareas });
});

// ── POST /api/tareas ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { titulo, descripcion, status } = req.body;

  if (!titulo || titulo.trim().length === 0) {
    return res.status(400).json({ mensaje: 'El campo título es obligatorio.' });
  }

  const statusFinal = status || 'pendiente';
  if (!['pendiente', 'completada'].includes(statusFinal)) {
    return res.status(400).json({
      mensaje: 'El campo status solo acepta los valores: pendiente, completada.'
    });
  }

  const { data: tareaCreada, error } = await supabase
    .from('tareas')
    .insert({
      usuario_id:  req.usuario.id,
      titulo:      titulo.trim(),
      descripcion: (descripcion || '').trim(),
      status:      statusFinal
    })
    .select()
    .single();

  if (error) {
    console.error('Error al crear tarea:', error.message);
    return res.status(500).json({ mensaje: 'Error al crear la tarea.' });
  }

  res.status(201).json({ mensaje: 'Tarea creada correctamente.', tarea: tareaCreada });
});

// ── PUT /api/tareas/:id ──────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { id } = req.params;

  const { data: tarea } = await supabase
    .from('tareas')
    .select('*')
    .eq('id', id)
    .eq('usuario_id', req.usuario.id)
    .maybeSingle();

  if (!tarea) {
    return res.status(404).json({ mensaje: `No se encontró la tarea con id ${id}.` });
  }

  const { titulo, descripcion, status } = req.body;

  if (status && !['pendiente', 'completada'].includes(status)) {
    return res.status(400).json({
      mensaje: 'El campo status solo acepta los valores: pendiente, completada.'
    });
  }

  const tituloFinal      = titulo      !== undefined ? titulo.trim()      : tarea.titulo;
  const descripcionFinal = descripcion !== undefined ? descripcion.trim() : tarea.descripcion;
  const statusFinal      = status      !== undefined ? status             : tarea.status;

  if (!tituloFinal) {
    return res.status(400).json({ mensaje: 'El campo título no puede quedar vacío.' });
  }

  const { data: tareaActualizada, error } = await supabase
    .from('tareas')
    .update({
      titulo:      tituloFinal,
      descripcion: descripcionFinal,
      status:      statusFinal,
      updated_at:  new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error al actualizar tarea:', error.message);
    return res.status(500).json({ mensaje: 'Error al actualizar la tarea.' });
  }

  res.status(200).json({ mensaje: 'Tarea actualizada correctamente.', tarea: tareaActualizada });
});

// ── DELETE /api/tareas/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const { data: tarea } = await supabase
    .from('tareas')
    .select('id')
    .eq('id', id)
    .eq('usuario_id', req.usuario.id)
    .maybeSingle();

  if (!tarea) {
    return res.status(404).json({ mensaje: `No se encontró la tarea con id ${id}.` });
  }

  const { error } = await supabase
    .from('tareas')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error al eliminar tarea:', error.message);
    return res.status(500).json({ mensaje: 'Error al eliminar la tarea.' });
  }

  res.status(200).json({ mensaje: `Tarea con id ${id} eliminada correctamente.` });
});

module.exports = router;
