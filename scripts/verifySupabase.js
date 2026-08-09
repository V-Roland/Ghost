import { createClient } from '@supabase/supabase-js';
import { requireSupabaseAdminConfiguration } from './supabaseConfig.js';

const tables = [
  'profiles', 'job_postings', 'interviewees', 'interviews', 'documents', 'supplemental_links',
  'questions', 'question_responses', 'integrity_signals', 'interview_files', 'archive_folders', 'reports', 'tags', 'audit_events'
];

function supabaseErrorMessage(error) {
  return [error?.code, error?.message, error?.details, error?.hint].filter(Boolean).join(' | ') || JSON.stringify(error);
}

async function main() {
  requireSupabaseAdminConfiguration();
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`${table}: ${supabaseErrorMessage(error)}`);
    console.log(`${table}: ${count} rows`);
  }

  const { error: positionColumnError } = await supabase.from('job_postings').select('work_arrangement,source_type,source_file_name', { head: true });
  if (positionColumnError) throw new Error(`job_postings workflow fields: ${supabaseErrorMessage(positionColumnError)}`);
  const { error: interviewColumnError } = await supabase
    .from('interviews')
    .select('archive_folder_id,resume_notes,processing_notes,supplement_notes', { head: true });
  if (interviewColumnError) throw new Error(`interviews workflow fields: ${supabaseErrorMessage(interviewColumnError)}`);
  const { error: fileColumnError } = await supabase.from('interview_files').select('job_posting_id,folder_id', { head: true });
  if (fileColumnError) throw new Error(`interview_files posting linkage: ${supabaseErrorMessage(fileColumnError)}`);
  const { error: folderColumnError } = await supabase
    .from('archive_folders')
    .select('job_posting_id,interview_id,parent_folder_id', { head: true });
  if (folderColumnError) throw new Error(`archive_folders scope fields: ${supabaseErrorMessage(folderColumnError)}`);

  const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
  if (storageError) throw storageError;
  const interviewBucket = buckets.find((bucket) => bucket.id === 'interview-files');
  if (!interviewBucket || interviewBucket.public) {
    throw new Error('The private interview-files storage bucket is missing or public.');
  }
  console.log('Supabase tables, workflow fields, and private Storage verification passed.');
}

main().catch((error) => {
  console.error(`Supabase verification failed: ${error.message}`);
  process.exitCode = 1;
});
