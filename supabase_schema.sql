-- ══════════════════════════════════════════════════════════════════════════════
--  QA App — Supabase Schema
--  Ejecuta este SQL en el SQL Editor de tu proyecto en supabase.com
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Tabla: usuarios ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username     TEXT UNIQUE NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabla: proyectos ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proyectos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  clave       TEXT UNIQUE NOT NULL,          -- Ej: "QA", "DEV", "WEB"
  owner_id    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabla: proyecto_miembros ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proyecto_miembros (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
  rol         TEXT NOT NULL DEFAULT 'member'
              CHECK (rol IN ('owner', 'admin', 'member', 'viewer')),
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (proyecto_id, usuario_id)
);

-- ── Tabla: issues ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issues (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  numero        INTEGER NOT NULL,
  titulo        TEXT NOT NULL,
  descripcion   TEXT,
  tipo          TEXT NOT NULL DEFAULT 'tarea'
                CHECK (tipo IN ('historia', 'bug', 'tarea', 'epica')),
  prioridad     TEXT NOT NULL DEFAULT 'media'
                CHECK (prioridad IN ('critica', 'alta', 'media', 'baja')),
  status        TEXT NOT NULL DEFAULT 'backlog'
                CHECK (status IN ('backlog', 'en_progreso', 'en_revision', 'listo')),
  asignado_a    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  reportado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (proyecto_id, numero)
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_issues_proyecto  ON issues (proyecto_id);
CREATE INDEX IF NOT EXISTS idx_issues_status    ON issues (status);
CREATE INDEX IF NOT EXISTS idx_issues_asignado  ON issues (asignado_a);

-- ── Tabla: comentarios ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comentarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  usuario_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  cuerpo      TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comentarios_issue ON comentarios (issue_id);

-- ── Tabla: historial_status ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS historial_status (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id         UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  usuario_id       UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  status_anterior  TEXT,
  status_nuevo     TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historial_issue ON historial_status (issue_id);

-- ── Deshabilitar RLS (el backend usa service_role key que lo bypasea igualmente)
-- ── Descomenta si quieres ser explícito:
-- ALTER TABLE usuarios          DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE proyectos         DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE proyecto_miembros DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE issues            DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE comentarios       DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE historial_status  DISABLE ROW LEVEL SECURITY;
