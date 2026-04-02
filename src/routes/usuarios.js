const express  = require('express');
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/usuarios — listar usuarios disponibles para asignar issues
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, username, email')
      .order('username');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('GET /usuarios:', err.message);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

module.exports = router;
