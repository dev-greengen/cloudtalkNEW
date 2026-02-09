import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://pmtpufqtohygciwsdewt.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;

// Create a mock client if credentials are missing to prevent crashes
let supabase;
if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Missing SUPABASE_URL or SUPABASE_KEY - using mock client');
  supabase = {
    from: () => ({
      select: () => ({ data: [], error: null }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null }),
      eq: function() { return this; },
      order: function() { return this; },
      limit: function() { return this; }
    })
  };
} else {
  supabase = createClient(supabaseUrl, supabaseKey);
}

export { supabase };

