import { createClient } from '@supabase/supabase-js';
import { requireSupabaseAdminConfiguration } from './supabaseConfig.js';

async function main() {
  requireSupabaseAdminConfiguration();
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw error;
  console.log('Supabase preflight passed: URL and server-only service-role credentials are valid.');
}

main().catch((error) => {
  console.error(`Supabase preflight failed: ${error.message}`);
  process.exitCode = 1;
});
