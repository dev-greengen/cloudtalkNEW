import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://pmtpufqtohygciwsdewt.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;

console.log('🔧 Initializing Supabase client...');
console.log('🔧 SUPABASE_URL:', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NOT SET');
console.log('🔧 SUPABASE_KEY:', supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'NOT SET');

// Create a mock client if credentials are missing to prevent crashes
let supabase;
if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Missing SUPABASE_URL or SUPABASE_KEY - using mock client');
  supabase = {
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
      eq: function() { return this; },
      order: function() { return this; },
      limit: function() { return this; },
      or: function() { return this; },
      not: function() { return this; },
      in: function() { return this; },
      single: function() { return this; }
    })
  };
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      },
      global: {
        fetch: (url, options = {}) => {
          console.log(`🌐 Supabase fetch: ${options.method || 'GET'} ${url}`);
          return fetch(url, {
            ...options,
            // Add timeout
            signal: AbortSignal.timeout(10000) // 10 second timeout
          }).catch(err => {
            console.error('❌ Supabase fetch error:', err.message);
            throw err;
          });
        }
      }
    });
    console.log('✅ Supabase client created successfully');
  } catch (err) {
    console.error('❌ Error creating Supabase client:', err.message);
    // Fallback to mock client
    supabase = {
      from: () => ({
        select: () => Promise.resolve({ data: [], error: { message: 'Supabase client creation failed' } }),
        insert: () => Promise.resolve({ data: null, error: { message: 'Supabase client creation failed' } }),
        update: () => Promise.resolve({ data: null, error: { message: 'Supabase client creation failed' } }),
        delete: () => Promise.resolve({ data: null, error: { message: 'Supabase client creation failed' } }),
        eq: function() { return this; },
        order: function() { return this; },
        limit: function() { return this; },
        or: function() { return this; },
        not: function() { return this; },
        in: function() { return this; },
        single: function() { return this; }
      })
    };
  }
}

export { supabase };

