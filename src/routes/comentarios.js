const express  = require('express');
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// DELETE /api/comentarios/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { data: comentario } = await supabase
      .from('comentarios')
      .select('usuario_id')
      .eq('id', req.params.id)
      .single();

    if (!comentario) return res.status(404).json({ error: 'Comentario no encontrado' });

    if (comentario.usuario_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo puedes eliminar tus propios comentarios' });
    }

    await supabase.from('comentarios').delete().eq('id', req.params.id);
    res.json({ message: 'Comentario eliminado' });
  } catch (err) {
    console.error('DELETE /comentarios/:id:', err.message);
    res.status(500).json({ error: 'Error al eliminar comentario' });
  }
});

module.exports = router;
