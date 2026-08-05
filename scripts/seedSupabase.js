import { createClient } from '@supabase/supabase-js';
import { assertDemoSeedTarget, requireSupabaseAdminConfiguration } from './supabaseConfig.js';

const demoUsers = [
  {
    email: process.env.DEMO_USER_EMAIL || 'nick@example.com',
    password: process.env.DEMO_USER_PASSWORD,
    displayName: process.env.DEMO_USER_DISPLAY_NAME || 'Nick Steltzner',
    role: 'Interviewer',
    jobId: '10000000-0000-4000-8000-000000000001',
    intervieweeId: '20000000-0000-4000-8000-000000000001',
    interviewId: '30000000-0000-4000-8000-000000000001',
    jobTitle: 'Senior Development Position 2026',
    candidateName: 'Robert James'
  },
  {
    email: process.env.DEMO_SECONDARY_USER_EMAIL || 'sally@example.com',
    password: process.env.DEMO_SECONDARY_USER_PASSWORD,
    displayName: process.env.DEMO_SECONDARY_USER_DISPLAY_NAME || 'Sally Chen',
    role: 'Interviewer',
    jobId: '10000000-0000-4000-8000-000000000002',
    intervieweeId: '20000000-0000-4000-8000-000000000002',
    interviewId: '30000000-0000-4000-8000-000000000002',
    jobTitle: 'Product Security Engineer 2026',
    candidateName: 'Jordan Lee'
  }
];

async function findOrCreateUser(supabase, demoUser) {
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  const existingUser = usersData.users.find((user) => user.email?.toLowerCase() === demoUser.email.toLowerCase());
  if (existingUser) return existingUser;

  const { data, error } = await supabase.auth.admin.createUser({
    email: demoUser.email,
    password: demoUser.password,
    email_confirm: true,
    user_metadata: { display_name: demoUser.displayName, role: demoUser.role }
  });
  if (error) throw error;
  return data.user;
}

async function seedUserRecords(supabase, demoUser, user) {
  const interviewDate = new Date().toISOString().slice(0, 10);
  const statements = [
    () => supabase.from('profiles').upsert({ id: user.id, display_name: demoUser.displayName, role: demoUser.role }),
    () => supabase.from('job_postings').upsert({ id: demoUser.jobId, user_id: user.id, title: demoUser.jobTitle, department: 'Engineering' }),
    () => supabase.from('interviewees').upsert({ id: demoUser.intervieweeId, user_id: user.id, full_name: demoUser.candidateName }),
    () => supabase.from('interviews').upsert({
      id: demoUser.interviewId,
      user_id: user.id,
      job_posting_id: demoUser.jobId,
      interviewee_id: demoUser.intervieweeId,
      job_posting_title: demoUser.jobTitle,
      candidate_name: demoUser.candidateName,
      interview_date: interviewDate,
      archive_path: `${demoUser.jobTitle}/${demoUser.candidateName} - ${interviewDate}`
    })
  ];
  for (const statement of statements) {
    const { error } = await statement();
    if (error) throw error;
  }
}

async function main() {
  requireSupabaseAdminConfiguration();
  assertDemoSeedTarget();
  const missingPassword = demoUsers.find((user) => !user.password || user.password.length < 15);
  if (missingPassword) {
    throw new Error('DEMO_USER_PASSWORD and DEMO_SECONDARY_USER_PASSWORD must each contain at least 15 characters.');
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  for (const demoUser of demoUsers) {
    const user = await findOrCreateUser(supabase, demoUser);
    await seedUserRecords(supabase, demoUser, user);
    console.log(`Seeded isolated demo workspace for ${demoUser.email}.`);
  }
}

main().catch((error) => {
  console.error(`Supabase seed failed: ${error.message}`);
  process.exitCode = 1;
});
