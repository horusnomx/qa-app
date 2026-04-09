const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const rateLimit = require('express-rate-limit');
const supabase  = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Intenta en 15 minutos.' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados registros desde esta IP. Intenta en 1 hora.' }
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiadas solicitudes de reset. Intenta en 1 hora.' }
});

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', registerLimiter, async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }
  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({ error: 'El username debe tener entre 3 y 30 caracteres' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  if (!/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);

    // El primer usuario registrado se convierte en admin automáticamente
    const { count } = await supabase
      .from('usuarios')
      .select('id', { count: 'exact', head: true });

    const { data: user, error } = await supabase
      .from('usuarios')
      .insert({
        username:      username.trim(),
        email:         email.trim().toLowerCase(),
        password_hash: hash,
        is_admin:      count === 0   // primer usuario = admin
      })
      .select('id, username, email, is_admin')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'El email o username ya existe' });
      }
      throw error;
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user: { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin } });
  } catch (err) {
    console.error('register:', err.message, err.details);
    res.status(500).json({ error: err.message || 'Error al registrar usuario' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('id, username, email, password_hash, is_admin')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin } });
  } catch (err) {
    console.error('login:', err.message);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
// Genera un token de reset y devuelve la URL de reset (sin email, apropiado
// para apps internas / QA). El token expira en 1 hora.
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'El email es requerido' });
  }

  try {
    const { data: user } = await supabase
      .from('usuarios')
      .select('id, email, username')
      .eq('email', email.trim().toLowerCase())
      .single();

    // Responde igual aunque el email no exista (evitar enumeración de usuarios)
    if (!user) {
      return res.json({ message: 'Si el email existe, recibirás el link de reset.' });
    }

    // Invalidar tokens anteriores del mismo usuario
    await supabase
      .from('reset_tokens')
      .update({ usado: true })
      .eq('usuario_id', user.id)
      .eq('tipo', 'reset')
      .eq('usado', false);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

    await supabase.from('reset_tokens').insert({
      usuario_id: user.id,
      token,
      tipo:       'reset',
      expires_at: expiresAt
    });

    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${baseUrl}/reset-password.html?token=${token}`;

    res.json({
      message:   'Token generado. Usa el link para resetear tu contraseña.',
      reset_url: resetUrl,   // visible en pantalla — apropiado para app interna
      expires_in: '1 hora'
    });
  } catch (err) {
    console.error('forgot-password:', err.message);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token y contraseña son requeridos' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const { data: rt } = await supabase
      .from('reset_tokens')
      .select('id, usuario_id, usado, expires_at')
      .eq('token', token)
      .single();

    if (!rt) {
      return res.status(400).json({ error: 'Token inválido' });
    }
    if (rt.usado) {
      return res.status(400).json({ error: 'El token ya fue utilizado' });
    }
    if (new Date(rt.expires_at) < new Date()) {
      return res.status(400).json({ error: 'El token ha expirado' });
    }

    const hash = await bcrypt.hash(password, 12);

    await Promise.all([
      supabase.from('usuarios').update({ password_hash: hash }).eq('id', rt.usuario_id),
      supabase.from('reset_tokens').update({ usado: true }).eq('id', rt.id)
    ]);

    res.json({ message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    console.error('reset-password:', err.message);
    res.status(500).json({ error: 'Error al resetear la contraseña' });
  }
});

module.exports = router;
