const express  = require('express');
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const ISSUE_SELECT = `
  id, proyecto_id, numero, titulo, descripcion, tipo, prioridad, status,
  asignado_a, reportado_por, created_at, updated_at,
  asignado:usuarios!issues_asignado_a_fkey(id, username, email),
  reportado:usuarios!issues_reportado_por_fkey(id, username, email),
  proyecto:proyectos(id, nombre, clave)
`;

async function getMembership(proyectoId, userId) {
  const { data } = await supabase
    .from('proyecto_miembros')
    .select('rol')
    .eq('proyecto_id', proyectoId)
    .eq('usuario_id', userId)
    .single();
  return data;
}

// GET /api/issues/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: issue, error } = await supabase
      .from('issues')
      .select(ISSUE_SELECT)
      .eq('id', req.params.id)
      .single();

    if (error || !issue) return res.status(404).json({ error: 'Issue no encontrado' });

    const member = await getMembership(issue.proyecto_id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Sin acceso' });

    res.json(issue);
  } catch (err) {
    console.error('GET /issues/:id:', err.message);
    res.status(500).json({ error: 'Error al obtener issue' });
  }
});

// PUT /api/issues/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { titulo, descripcion, tipo, prioridad, status, asignado_a } = req.body;

  try {
    const { data: issue } = await supabase
      .from('issues')
      .select('proyecto_id, status')
      .eq('id', req.params.id)
      .single();

    if (!issue) return res.status(404).json({ error: 'Issue no encontrado' });

    const member = await getMembership(issue.proyecto_id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Sin acceso' });

    const TIPOS_VALIDOS = ['historia', 'bug', 'tarea', 'epica'];
    const PRIOS_VALIDAS = ['critica', 'alta', 'media', 'baja'];
    const STATUS_VALIDOS = ['backlog', 'en_progreso', 'en_revision', 'listo'];

    const updates = { updated_at: new Date().toISOString() };
    if (titulo !== undefined)      updates.titulo      = titulo.trim();
    if (descripcion !== undefined) updates.descripcion = descripcion;
    if (tipo !== undefined && TIPOS_VALIDOS.includes(tipo)) updates.tipo = tipo;
    if (prioridad !== undefined && PRIOS_VALIDAS.includes(prioridad)) updates.prioridad = prioridad;
    if (status !== undefined && STATUS_VALIDOS.includes(status)) updates.status = status;
    if (asignado_a !== undefined)  updates.asignado_a  = asignado_a || null;

    // Registrar cambio de status en historial
    if (status && status !== issue.status) {
      await supabase.from('historial_status').insert({
        issue_id:        req.params.id,
        usuario_id:      req.user.id,
        status_anterior: issue.status,
        status_nuevo:    status
      });
    }

    const { data: updated, error } = await supabase
      .from('issues')
      .update(updates)
      .eq('id', req.params.id)
      .select(ISSUE_SELECT)
      .single();

    if (error) throw error;
    res.json(updated);
  } catch (err) {
    console.error('PUT /issues/:id:', err.message);
    res.status(500).json({ error: 'Error al actualizar issue' });
  }
});

// DELETE /api/issues/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { data: issue } = await supabase
      .from('issues')
      .select('proyecto_id')
      .eq('id', req.params.id)
      .single();

    if (!issue) return res.status(404).json({ error: 'Issue no encontrado' });

    const member = await getMembership(issue.proyecto_id, req.user.id);
    if (!member || member.rol === 'viewer') {
      return res.status(403).json({ error: 'Sin permisos para eliminar' });
    }

    await supabase.from('issues').delete().eq('id', req.params.id);
    res.json({ message: 'Issue eliminado' });
  } catch (err) {
    console.error('DELETE /issues/:id:', err.message);
    res.status(500).json({ error: 'Error al eliminar issue' });
  }
});

// PATCH /api/issues/:id/status
router.patch('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  const STATUS_VALIDOS = ['backlog', 'en_progreso', 'en_revision', 'listo'];

  if (!STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ error: `Status inválido. Válidos: ${STATUS_VALIDOS.join(', ')}` });
  }

  try {
    const { data: issue } = await supabase
      .from('issues')
      .select('proyecto_id, status')
      .eq('id', req.params.id)
      .single();

    if (!issue) return res.status(404).json({ error: 'Issue no encontrado' });

    const member = await getMembership(issue.proyecto_id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Sin acceso' });

    if (issue.status !== status) {
      await supabase.from('historial_status').insert({
        issue_id:        req.params.id,
        usuario_id:      req.user.id,
        status_anterior: issue.status,
        status_nuevo:    status
      });
    }

    const { data: updated, error } = await supabase
      .from('issues')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(updated);
  } catch (err) {
    console.error('PATCH /issues/:id/status:', err.message);
    res.status(500).json({ error: 'Error al cambiar status' });
  }
});

// GET /api/issues/:id/comentarios
router.get('/:id/comentarios', requireAuth, async (req, res) => {
  try {
    const { data: issue } = await supabase
      .from('issues')
      .select('proyecto_id')
      .eq('id', req.params.id)
      .single();

    if (!issue) return res.status(404).json({ error: 'Issue no encontrado' });

    const member = await getMembership(issue.proyecto_id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Sin acceso' });

    const { data, error } = await supabase
      .from('comentarios')
      .select('id, cuerpo, created_at, usuario:usuarios(id, username, email)')
      .eq('issue_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /issues/:id/comentarios:', err.message);
    res.status(500).json({ error: 'Error al obtener comentarios' });
  }
});

// POST /api/issues/:id/comentarios
router.post('/:id/comentarios', requireAuth, async (req, res) => {
  const { cuerpo } = req.body;
  if (!cuerpo || !cuerpo.trim()) {
    return res.status(400).json({ error: 'El comentario no puede estar vacío' });
  }

  try {
    const { data: issue } = await supabase
      .from('issues')
      .select('proyecto_id')
      .eq('id', req.params.id)
      .single();

    if (!issue) return res.status(404).json({ error: 'Issue no encontrado' });

    const member = await getMembership(issue.proyecto_id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Sin acceso' });

    const { data: comentario, error } = await supabase
      .from('comentarios')
      .insert({ issue_id: req.params.id, usuario_id: req.user.id, cuerpo: cuerpo.trim() })
      .select('id, cuerpo, created_at, usuario:usuarios(id, username, email)')
      .single();

    if (error) throw error;
    res.status(201).json(comentario);
  } catch (err) {
    console.error('POST /issues/:id/comentarios:', err.message);
    res.status(500).json({ error: 'Error al agregar comentario' });
  }
});

// GET /api/issues/:id/historial
router.get('/:id/historial', requireAuth, async (req, res) => {
  try {
    const { data: issue } = await supabase
      .from('issues')
      .select('proyecto_id')
      .eq('id', req.params.id)
      .single();

    if (!issue) return res.status(404).json({ error: 'Issue no encontrado' });

    const member = await getMembership(issue.proyecto_id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Sin acceso' });

    const { data, error } = await supabase
      .from('historial_status')
      .select('id, status_anterior, status_nuevo, created_at, usuario:usuarios(id, username, email)')
      .eq('issue_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /issues/:id/historial:', err.message);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

module.exports = router;
