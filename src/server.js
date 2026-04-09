require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const fs         = require('fs');

const app = express();

// ── Directorios ──────────────────────────────────────────────────────────────
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, cb) => {
    // Permitir requests sin origin (Postman, Railway health checks, mismo servidor)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origen no permitido — ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ── Security headers (Helmet) ─────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      imgSrc:     ["'self'", "data:"],
      frameAncestors: ["'none'"],   // Clickjacking protection
    }
  },
  crossOriginEmbedderPolicy: false,   // necesario para Sortable.js CDN
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// ── Logs ─────────────────────────────────────────────────────────────────────
const accessLog = fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLog }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ── Parsers y estáticos ──────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Rate limiting global para API ────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta en 15 minutos.' }
});
app.use('/api', apiLimiter);

// ── Rutas API ────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/proyectos',   require('./routes/proyectos'));
app.use('/api/issues',      require('./routes/issues'));
app.use('/api/comentarios', require('./routes/comentarios'));
app.use('/api/usuarios',    require('./routes/usuarios'));
app.use('/api/admin',       require('./routes/admin'));

// ── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Error interno del servidor' });
});

// ── Arranque ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`QA App API corriendo en http://localhost:${PORT}`));
