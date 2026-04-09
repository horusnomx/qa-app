-- ══════════════════════════════════════════════════════════════════════════════
--  QA App — Supabase Schema v2
--  Ejecuta este SQL en el SQL Editor de tu proyecto en supabase.com
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Limpieza previa ───────────────────────────────────────────────────────────
DROP TABLE IF EXISTS reset_tokens      CASCADE;
DROP TABLE IF EXISTS historial_status  CASCADE;
DROP TABLE IF EXISTS comentarios       CASCADE;
DROP TABLE IF EXISTS issues            CASCADE;
DROP TABLE IF EXISTS proyecto_miembros CASCADE;
DROP TABLE IF EXISTS proyectos         CASCADE;
DROP TABLE IF EXISTS usuarios          CASCADE;

-- ── Tabla: usuarios ──────────────────────────────────────────────────────────
CREATE TABLE usuarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabla: reset_tokens ───────────────────────────────────────────────────────
-- Sirve para "forgot password" y contraseñas temporales de admin
CREATE TABLE reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'reset'
              CHECK (tipo IN ('reset', 'temporal')),  -- reset=usuario, temporal=admin
  usado       BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reset_tokens_token ON reset_tokens (token);

-- ── Tabla: proyectos ─────────────────────────────────────────────────────────
CREATE TABLE proyectos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  clave       TEXT UNIQUE NOT NULL,
  owner_id    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabla: proyecto_miembros ─────────────────────────────────────────────────
CREATE TABLE proyecto_miembros (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
  rol         TEXT NOT NULL DEFAULT 'member'
              CHECK (rol IN ('owner', 'admin', 'member', 'viewer')),
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (proyecto_id, usuario_id)
);

-- ── Tabla: issues ────────────────────────────────────────────────────────────
CREATE TABLE issues (
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

CREATE INDEX idx_issues_proyecto ON issues (proyecto_id);
CREATE INDEX idx_issues_status   ON issues (status);
CREATE INDEX idx_issues_asignado ON issues (asignado_a);

-- ── Tabla: comentarios ───────────────────────────────────────────────────────
CREATE TABLE comentarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  usuario_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  cuerpo      TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comentarios_issue ON comentarios (issue_id);

-- ── Tabla: historial_status ──────────────────────────────────────────────────
CREATE TABLE historial_status (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id         UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  usuario_id       UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  status_anterior  TEXT,
  status_nuevo     TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_historial_issue ON historial_status (issue_id);


-- ══════════════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
--  El backend usa service_role key → bypasea RLS automáticamente.
--  Activamos RLS de todas formas como capa de defensa adicional por si
--  alguien accede directamente a la DB con un anon key.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE usuarios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reset_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyecto_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues            ENABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_status  ENABLE ROW LEVEL SECURITY;

-- Con service_role key (que usamos en el backend) RLS no aplica.
-- Con anon key, ninguna operación directa es posible (deny-all por defecto).
-- Si en el futuro quieres exponer alguna tabla al cliente directamente,
-- agrega políticas específicas aquí.
