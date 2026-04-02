// routes/auth.js
// Endpoints de autenticación: registro y login de usuarios.

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const supabase = require('../database');

const router = express.Router();

// ── POST /api/auth/registro ──────────────────────────────────────────────────
router.post('/registro', async (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({
      mensaje: 'Los campos nombre, email y password son obligatorios.'
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ mensaje: 'El email no tiene un formato válido.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  const emailNorm = email.toLowerCase().trim();

  const { data: existente } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', emailNorm)
    .maybeSingle();

  if (existente) {
    return res.status(400).json({ mensaje: 'Ya existe una cuenta con ese email.' });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from('usuarios')
    .insert({ nombre: nombre.trim(), email: emailNorm, password_hash })
    .select('id, nombre, email')
    .single();

  if (error) {
    console.error('Error al registrar usuario:', error.message);
    return res.status(500).json({ mensaje: 'Error al crear el usuario.' });
  }

  res.status(201).json({
    mensaje: 'Usuario registrado correctamente.',
    usuario: data
  });
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ mensaje: 'Email y password son obligatorios.' });
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (!usuario || !(await bcrypt.compare(password, usuario.password_hash))) {
    return res.status(401).json({ mensaje: 'Credenciales inválidas.' });
  }

  const token = jwt.sign(
    { id: usuario.id, email: usuario.email, nombre: usuario.nombre },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.status(200).json({
    mensaje: 'Login exitoso.',
    token,
    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email }
  });
});

module.exports = router;
