-- migrations/schema.sql
-- Ejecutar este script en el SQL Editor de Supabase (una sola vez).
-- Dashboard → SQL Editor → New query → pegar y ejecutar.

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tareas (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo      TEXT        NOT NULL,
  descripcion TEXT        NOT NULL DEFAULT '',
  status      TEXT        NOT NULL DEFAULT 'pendiente'
                CHECK (status IN ('pendiente', 'completada')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
