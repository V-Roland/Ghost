import { createClient } from '@supabase/supabase-js';

function supabaseConfiguration() {
  return {
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
    supabaseUrl: process.env.SUPABASE_URL
  };
}

export function assertSupabaseConfiguration() {
  const { publishableKey, supabaseUrl } = supabaseConfiguration();
  const missing = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!publishableKey) missing.push('SUPABASE_PUBLISHABLE_KEY');
  if (missing.length) {
    throw new Error(`Missing required Supabase environment variables: ${missing.join(', ')}.`);
  }
}

function clientOptions(accessToken) {
  return {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {})
  };
}

export function createTokenVerifier() {
  assertSupabaseConfiguration();
  const { publishableKey, supabaseUrl } = supabaseConfiguration();
  return createClient(supabaseUrl, publishableKey, clientOptions());
}

export function createUserClient(accessToken) {
  assertSupabaseConfiguration();
  const { publishableKey, supabaseUrl } = supabaseConfiguration();
  return createClient(supabaseUrl, publishableKey, clientOptions(accessToken));
}
