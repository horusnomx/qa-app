const { createClient } = require('@supabase/supabase-js');

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!process.env.SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  SUPABASE_KEY,
  { auth: { persistSession: false } }
);

module.exports = supabase;
