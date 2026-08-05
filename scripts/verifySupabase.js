import { createClient } from '@supabase/supabase-js';
import { requireSupabaseAdminConfiguration } from './supabaseConfig.js';

const tables = [
  'profiles', 'job_postings', 'interviewees', 'interviews', 'documents', 'supplemental_links',
  'questions', 'question_responses', 'integrity_signals', 'interview_files', 'reports', 'tags', 'audit_events'
];

async function main() {
  requireSupabaseAdminConfiguration();
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`${table}: ${count} rows`);
  }

  const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
  if (storageError) throw storageError;
  const interviewBucket = buckets.find((bucket) => bucket.id === 'interview-files');
  if (!interviewBucket || interviewBucket.public) {
    throw new Error('The private interview-files storage bucket is missing or public.');
  }
  console.log('Supabase verification passed.');
}

main().catch((error) => {
  console.error(`Supabase verification failed: ${error.message}`);
  process.exitCode = 1;
});
