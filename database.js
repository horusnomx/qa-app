// database.js
// Crea y exporta el cliente de Supabase.
// Las tablas se crean en Supabase vía migrations/schema.sql (ver ese archivo).

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = supabase;
