import { createClient } from '@supabase/supabase-js';
import { assertRlsTestTarget, requireSupabaseClientConfiguration } from './supabaseConfig.js';

function userClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function signIn(email, password) {
  const supabase = userClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw error || new Error(`Sign-in failed for ${email}.`);
  return { supabase, user: data.user };
}

function assertBlocked(error, message) {
  if (!error) throw new Error(message);
}

async function main() {
  requireSupabaseClientConfiguration();
  assertRlsTestTarget();
  const sallyEmail = process.env.DEMO_SECONDARY_USER_EMAIL || 'sally@example.com';
  const nickEmail = process.env.DEMO_USER_EMAIL || 'nick@example.com';
  if (!process.env.DEMO_SECONDARY_USER_PASSWORD || !process.env.DEMO_USER_PASSWORD) {
    throw new Error('Both demo passwords are required. Run the guarded demo seed first.');
  }

  const sally = await signIn(sallyEmail, process.env.DEMO_SECONDARY_USER_PASSWORD);
  const nick = await signIn(nickEmail, process.env.DEMO_USER_PASSWORD);
  const runId = crypto.randomUUID();
  const storagePath = `${sally.user.id}/rls-checks/${runId}.txt`;
  let jobId;
  let interviewId;

  try {
    const { data: job, error: jobError } = await sally.supabase
      .from('job_postings')
      .insert({ title: `RLS Check ${runId}` })
      .select('id,user_id')
      .single();
    if (jobError) throw jobError;
    jobId = job.id;

    const { data: interview, error: interviewError } = await sally.supabase
      .from('interviews')
      .insert({
        job_posting_id: job.id,
        job_posting_title: `RLS Check ${runId}`,
        candidate_name: 'Isolation Test Candidate',
        interview_date: new Date().toISOString().slice(0, 10),
        archive_path: `RLS Check/${runId}`
      })
      .select('id,user_id')
      .single();
    if (interviewError) throw interviewError;
    interviewId = interview.id;

    const { data: leakedRows, error: readError } = await nick.supabase
      .from('interviews')
      .select('id')
      .eq('id', interview.id);
    if (readError) throw readError;
    if (leakedRows.length) throw new Error('RLS failure: Nick can read Sally\'s interview.');

    const { error: spoofError } = await nick.supabase.from('interviews').insert({
      user_id: sally.user.id,
      job_posting_title: 'Owner Spoof Attempt',
      candidate_name: 'Isolation Test Candidate',
      interview_date: new Date().toISOString().slice(0, 10),
      archive_path: `Owner Spoof/${runId}`
    });
    assertBlocked(spoofError, 'RLS failure: Nick can create a row owned by Sally.');

    const { error: referenceError } = await nick.supabase.from('interviews').insert({
      job_posting_id: job.id,
      job_posting_title: 'Cross-owner Reference Attempt',
      candidate_name: 'Isolation Test Candidate',
      interview_date: new Date().toISOString().slice(0, 10),
      archive_path: `Cross-owner Reference/${runId}`
    });
    assertBlocked(referenceError, 'Ownership constraint failure: Nick can reference Sally\'s job posting.');

    const { error: uploadError } = await sally.supabase.storage
      .from('interview-files')
      .upload(storagePath, new TextEncoder().encode('RLS isolation check'), { contentType: 'text/plain' });
    if (uploadError) throw uploadError;

    const { error: storageReadError } = await nick.supabase.storage.from('interview-files').download(storagePath);
    assertBlocked(storageReadError, 'Storage RLS failure: Nick can download Sally\'s object.');

    console.log('Two-user Supabase isolation verification passed.');
  } finally {
    await sally.supabase.storage.from('interview-files').remove([storagePath]);
    if (interviewId) await sally.supabase.from('interviews').delete().eq('id', interviewId);
    if (jobId) await sally.supabase.from('job_postings').delete().eq('id', jobId);
    await Promise.all([sally.supabase.auth.signOut(), nick.supabase.auth.signOut()]);
  }
}

main().catch((error) => {
  console.error(`Supabase isolation verification failed: ${error.message}`);
  process.exitCode = 1;
});
