import fs from 'node:fs';
import path from 'node:path';

const requiredFiles = [
  'AGENTS.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'docs/API.md',
  'docs/DEVELOPMENT.md',
  'docs/GUARDRAILS.md',
  'docs/SUPABASE.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/workflows/quality.yml',
  'apps/api/test/interviewLifecycle.test.js',
  'apps/api/test/archiveFolders.test.js',
  'apps/api/test/authSecurity.test.js',
  'apps/api/test/afterInterview.test.js',
  'apps/api/test/reportGenerator.test.js',
  'apps/api/test/supabaseError.test.js',
  'apps/frontend/test/archiveRecords.test.js',
  'apps/frontend/test/archiveDirectories.test.js',
  'apps/frontend/test/zipArchive.test.js',
  'apps/frontend/test/interviewDraft.test.js',
  'scripts/test/supabaseSchema.test.js',
  'supabase/migrations/20260805000100_ghost_schema.sql',
  'supabase/migrations/20260806000100_interview_workspace_creation.sql',
  'supabase/migrations/20260806000200_job_posting_sources.sql',
  'supabase/migrations/20260806000300_archive_folders.sql',
  'supabase/migrations/20260807000100_interview_directory_placement.sql'
];

const requiredGuardrailTopics = [
  'human-in-the-loop',
  'hiring decisions',
  'sensitive hiring data',
  'retention',
  'Microsoft Entra ID',
  'human review',
  'row-level',
  'password hashing',
  'Supabase Auth'
];

const forbiddenRuntimePhrases = [
  'cheating detected',
  'candidate cheated',
  'fraud confirmed',
  'reject candidate',
  'automatic rejection',
  'ai hiring score',
  'final hiring score'
];

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(entryPath);
    return /\.(?:js|jsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

let failed = false;

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required guardrail file: ${file}`);
    failed = true;
  }
}

if (fs.existsSync('docs/GUARDRAILS.md')) {
  const guardrails = fs.readFileSync('docs/GUARDRAILS.md', 'utf8').toLowerCase();
  for (const topic of requiredGuardrailTopics) {
    if (!guardrails.includes(topic.toLowerCase())) {
      console.error(`docs/GUARDRAILS.md is missing required topic: ${topic}`);
      failed = true;
    }
  }
}

for (const sourceFile of [...filesUnder('apps/api/src'), ...filesUnder('apps/frontend/src')]) {
  const content = fs.readFileSync(sourceFile, 'utf8').toLowerCase();
  for (const phrase of forbiddenRuntimePhrases) {
    if (content.includes(phrase)) {
      console.error(`Forbidden runtime phrase "${phrase}" found in ${sourceFile}`);
      failed = true;
    }
  }
}

for (const sourceFile of filesUnder('apps/frontend/src')) {
  const content = fs.readFileSync(sourceFile, 'utf8');
  if (/service.role|SUPABASE_SERVICE_ROLE_KEY/i.test(content)) {
    console.error(`Server-only Supabase credentials referenced by browser source: ${sourceFile}`);
    failed = true;
  }
}

if (fs.existsSync('supabase/migrations/20260805000100_ghost_schema.sql')) {
  const migration = fs.readdirSync('supabase/migrations')
    .filter((file) => file.endsWith('.sql'))
    .map((file) => fs.readFileSync(path.join('supabase/migrations', file), 'utf8'))
    .join('\n')
    .toLowerCase();
  const protectedTables = [
    'profiles', 'job_postings', 'interviewees', 'interviews', 'documents', 'supplemental_links',
    'questions', 'question_responses', 'integrity_signals', 'interview_files', 'archive_folders', 'reports', 'tags', 'audit_events'
  ];
  for (const table of protectedTables) {
    if (!migration.includes(`public.${table}`)) {
      console.error(`Supabase migration does not define protected table: ${table}`);
      failed = true;
    }
  }
  if (!migration.includes('enable row level security') || !migration.includes('auth.uid()')) {
    console.error('Supabase migration must enable RLS and bind policies to auth.uid().');
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('Guardrail check passed.');
