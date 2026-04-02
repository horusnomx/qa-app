const express  = require('express');
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Verifica si el usuario es miembro del proyecto. Devuelve {rol} o null.
async function getMembership(proyectoId, userId) {
  const { data } = await supabase
    .from('proyecto_miembros')
    .select('rol')
    .eq('proyecto_id', proyectoId)
    .eq('usuario_id', userId)
    .single();
  return data;
}

// GET /api/proyectos
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data: memberships, error } = await supabase
      .from('proyecto_miembros')
      .select('rol, proyectos(id, nombre, descripcion, clave, owner_id, created_at)')
      .eq('usuario_id', req.user.id);

    if (error) throw error;

    const proyectos = await Promise.all(
      memberships
        .filter(m => m.proyectos)
        .map(async (m) => {
          const p = m.proyectos;
          const { count } = await supabase
            .from('issues')
            .select('id', { count: 'exact', head: true })
            .eq('proyecto_id', p.id)
            .neq('status', 'listo');
          return { ...p, rol: m.rol, issues_abiertos: count || 0 };
        })
    );

    res.json(proyectos);
  } catch (err) {
    console.error('GET /proyectos:', err.message);
    res.status(500).json({ error: 'Error al obtener proyectos' });
  }
});

// POST /api/proyectos
router.post('/', requireAuth, async (req, res) => {
  const { nombre, descripcion, clave } = req.body;

  if (!nombre || !clave) {
    return res.status(400).json({ error: 'Nombre y clave son requeridos' });
  }
  const claveUpper = String(clave).toUpperCase().replace(/[^A-Z]/g, '');
  if (claveUpper.length < 2 || claveUpper.length > 10) {
    return res.status(400).json({ error: 'La clave debe tener entre 2 y 10 letras' });
  }

  try {
    const { data: proj, error } = await supabase
      .from('proyectos')
      .insert({ nombre: nombre.trim(), descripcion, clave: claveUpper, owner_id: req.user.id })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: 'La clave de proyecto ya existe' });
      throw error;
    }

    await supabase.from('proyecto_miembros').insert({
      proyecto_id: proj.id,
      usuario_id: req.user.id,
      rol: 'owner'
    });

    res.status(201).json(proj);
  } catch (err) {
    console.error('POST /proyectos:', err.message);
    res.status(500).json({ error: 'Error al crear proyecto' });
  }
});

// GET /api/proyectos/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const member = await getMembership(req.params.id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Sin acceso a este proyecto' });

    const { data: proj, error } = await supabase
      .from('proyectos')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !proj) return res.status(404).json({ error: 'Proyecto no encontrado' });

    res.json({ ...proj, rol: member.rol });
  } catch (err) {
    console.error('GET /proyectos/:id:', err.message);
    res.status(500).json({ error: 'Error al obtener proyecto' });
  }
});

// PUT /api/proyectos/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { nombre, descripcion } = req.body;

  try {
    const member = await getMembership(req.params.id, req.user.id);
    if (!member || !['owner', 'admin'].includes(member.rol)) {
      return res.status(403).json({ error: 'Sin permisos para editar' });
    }

    const { data: proj, error } = await supabase
      .from('proyectos')
      .update({ nombre, descripcion, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(proj);
  } catch (err) {
    console.error('PUT /proyectos/:id:', err.message);
    res.status(500).json({ error: 'Error al actualizar proyecto' });
  }
});

// DELETE /api/proyectos/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { data: proj } = await supabase
      .from('proyectos')
      .select('owner_id')
      .eq('id', req.params.id)
      .single();

    if (!proj || proj.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo el owner puede eliminar el proyecto' });
    }

    await supabase.from('proyectos').delete().eq('id', req.params.id);
    res.json({ message: 'Proyecto eliminado' });
  } catch (err) {
    console.error('DELETE /proyectos/:id:', err.message);
    res.status(500).json({ error: 'Error al eliminar proyecto' });
  }
});

// GET /api/proyectos/:id/miembros
router.get('/:id/miembros', requireAuth, async (req, res) => {
  try {
    const member = await getMembership(req.params.id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Sin acceso' });

    const { data, error } = await supabase
      .from('proyecto_miembros')
      .select('rol, usuarios(id, username, email)')
      .eq('proyecto_id', req.params.id);

    if (error) throw error;
    res.json(data.filter(m => m.usuarios).map(m => ({ ...m.usuarios, rol: m.rol })));
  } catch (err) {
    console.error('GET /proyectos/:id/miembros:', err.message);
    res.status(500).json({ error: 'Error al obtener miembros' });
  }
});

// GET /api/proyectos/:id/issues  — listar con filtros
router.get('/:id/issues', requireAuth, async (req, res) => {
  const { status, tipo, prioridad, asignado } = req.query;

  try {
    const member = await getMembership(req.params.id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Sin acceso' });

    let query = supabase
      .from('issues')
      .select(`
        id, proyecto_id, numero, titulo, tipo, prioridad, status, asignado_a, reportado_por, created_at, updated_at,
        asignado:usuarios!issues_asignado_a_fkey(id, username, email),
        proyecto:proyectos(clave)
      `)
      .eq('proyecto_id', req.params.id)
      .order('numero', { ascending: false });

    if (status)    query = query.eq('status', status);
    if (tipo)      query = query.eq('tipo', tipo);
    if (prioridad) query = query.eq('prioridad', prioridad);
    if (asignado)  query = query.eq('asignado_a', asignado);

    const { data: issues, error } = await query;
    if (error) throw error;

    res.json(issues);
  } catch (err) {
    console.error('GET /proyectos/:id/issues:', err.message);
    res.status(500).json({ error: 'Error al obtener issues' });
  }
});

// POST /api/proyectos/:id/issues — crear issue
router.post('/:id/issues', requireAuth, async (req, res) => {
  const { titulo, descripcion, tipo, prioridad, status, asignado_a } = req.body;

  if (!titulo || !titulo.trim()) {
    return res.status(400).json({ error: 'El título es requerido' });
  }

  try {
    const member = await getMembership(req.params.id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Sin acceso' });

    // Número auto-incremental por proyecto
    const { data: last } = await supabase
      .from('issues')
      .select('numero')
      .eq('proyecto_id', req.params.id)
      .order('numero', { ascending: false })
      .limit(1)
      .single();

    const numero = (last?.numero || 0) + 1;

    const TIPOS_VALIDOS = ['historia', 'bug', 'tarea', 'epica'];
    const PRIOS_VALIDAS = ['critica', 'alta', 'media', 'baja'];
    const STATUS_VALIDOS = ['backlog', 'en_progreso', 'en_revision', 'listo'];

    const { data: issue, error } = await supabase
      .from('issues')
      .insert({
        proyecto_id:   req.params.id,
        numero,
        titulo:        titulo.trim(),
        descripcion:   descripcion || null,
        tipo:          TIPOS_VALIDOS.includes(tipo) ? tipo : 'tarea',
        prioridad:     PRIOS_VALIDAS.includes(prioridad) ? prioridad : 'media',
        status:        STATUS_VALIDOS.includes(status) ? status : 'backlog',
        asignado_a:    asignado_a || null,
        reportado_por: req.user.id
      })
      .select(`
        id, proyecto_id, numero, titulo, tipo, prioridad, status, asignado_a, reportado_por, created_at, updated_at,
        asignado:usuarios!issues_asignado_a_fkey(id, username, email),
        proyecto:proyectos(clave)
      `)
      .single();

    if (error) throw error;
    res.status(201).json(issue);
  } catch (err) {
    console.error('POST /proyectos/:id/issues:', err.message);
    res.status(500).json({ error: 'Error al crear issue' });
  }
});

module.exports = router;
