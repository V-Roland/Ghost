import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

export function assertSupabaseConfiguration() {
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
  return createClient(supabaseUrl, publishableKey, clientOptions());
}

export function createUserClient(accessToken) {
  assertSupabaseConfiguration();
  return createClient(supabaseUrl, publishableKey, clientOptions(accessToken));
}
