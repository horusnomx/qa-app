const express  = require('express');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Middleware: solo admins globales
function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}

// ── GET /api/admin/usuarios ───────────────────────────────────────────────────
router.get('/usuarios', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, username, email, is_admin, created_at')
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /admin/usuarios:', err.message);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// ── PATCH /api/admin/usuarios/:id/admin ───────────────────────────────────────
// Promover o quitar rol admin a un usuario
router.patch('/usuarios/:id/admin', requireAuth, requireAdmin, async (req, res) => {
  const { is_admin } = req.body;

  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'No puedes modificar tu propio rol de admin' });
  }

  try {
    const { data, error } = await supabase
      .from('usuarios')
      .update({ is_admin: Boolean(is_admin) })
      .eq('id', req.params.id)
      .select('id, username, email, is_admin')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json(data);
  } catch (err) {
    console.error('PATCH /admin/usuarios/:id/admin:', err.message);
    res.status(500).json({ error: 'Error al actualizar rol' });
  }
});

// ── POST /api/admin/usuarios/:id/reset-password ───────────────────────────────
// El admin genera una contraseña temporal para un usuario.
// Devuelve la contraseña en texto plano UNA SOLA VEZ para que el admin la
// comparta con el usuario.
router.post('/usuarios/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, username, email')
      .eq('id', req.params.id)
      .single();

    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Generar contraseña temporal de 12 chars legible
    const tempPassword = crypto.randomBytes(6).toString('hex'); // 12 chars hex

    const hash = await bcrypt.hash(tempPassword, 12);

    // Invalidar todos los reset tokens anteriores del usuario
    await supabase
      .from('reset_tokens')
      .update({ usado: true })
      .eq('usuario_id', req.params.id)
      .eq('usado', false);

    // Actualizar contraseña en la DB
    await supabase
      .from('usuarios')
      .update({ password_hash: hash })
      .eq('id', req.params.id);

    // Guardar registro del reset temporal
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
    await supabase.from('reset_tokens').insert({
      usuario_id: req.params.id,
      token:      crypto.randomBytes(32).toString('hex'),
      tipo:       'temporal',
      usado:      true,   // ya se aplicó, solo es registro
      expires_at: expiresAt
    });

    res.json({
      message:        `Contraseña temporal generada para ${usuario.username}`,
      usuario:        { id: usuario.id, username: usuario.username, email: usuario.email },
      temp_password:  tempPassword,  // mostrar UNA sola vez
      nota:           'Comparte esta contraseña con el usuario. Debe cambiarla al iniciar sesión.'
    });
  } catch (err) {
    console.error('POST /admin/usuarios/:id/reset-password:', err.message);
    res.status(500).json({ error: 'Error al generar contraseña temporal' });
  }
});

module.exports = router;
