// server.js
// Punto de entrada de la aplicación.
// Configura Express, middlewares globales y monta las rutas.

require('dotenv').config(); // cargar variables de entorno desde .env

const express = require('express');
const cors    = require('cors');
const path    = require('path');

// Cliente de Supabase (inicializa la conexión al importar)
require('./database');

const app = express();

// ── Middlewares globales ─────────────────────────────────────────────────────

// Servir archivos estáticos desde /public (index.html, registro.html, tareas.html)
app.use(express.static(path.join(__dirname, 'public')));

// CORS: permite que otros orígenes (ej: Playwright, Postman, frontend) consuman la API
app.use(cors({
  origin: '*',                              // en producción, especificar los dominios permitidos
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parsear body de los requests como JSON
app.use(express.json());

// ── Rutas ────────────────────────────────────────────────────────────────────
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/tareas', require('./routes/tareas'));

// ── Ruta de salud (health check) ─────────────────────────────────────────────
// Útil para verificar que el servidor está corriendo antes de ejecutar los tests
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    mensaje: 'API funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// ── Ruta 404 para endpoints no definidos ─────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ mensaje: `Ruta ${req.method} ${req.path} no encontrada.` });
});

// ── Manejador de errores global ──────────────────────────────────────────────
// Captura cualquier error no manejado y devuelve una respuesta JSON limpia
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err.message);
  res.status(500).json({ mensaje: 'Error interno del servidor.' });
});

// ── Arrancar servidor ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n✅  API corriendo en http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
