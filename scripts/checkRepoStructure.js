import fs from 'node:fs';

const required = [
  'README.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  '.env.example',
  'scripts/supabaseConfig.js',
  'scripts/preflightSupabase.js',
  'scripts/seedSupabase.js',
  'scripts/verifySupabase.js',
  'scripts/verifySupabaseIsolation.js',
  'supabase/config.toml',
  'supabase/seed.sql',
  'supabase/migrations/20260805000100_ghost_schema.sql',
  'docs/EER.md',
  'docs/SUPABASE.md',
  'docs/UI_SPEC.md',
  'docs/AI_AGENT_PROMPTS.md',
  'docs/API.md',
  'docs/DEVELOPMENT.md',
  'docs/GUARDRAILS.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/workflows/quality.yml',
  'scripts/test/supabaseSchema.test.js',
  'apps/frontend/package.json',
  'apps/frontend/.env.example',
  'apps/frontend/vite.config.js',
  'apps/frontend/src/app/App.jsx',
  'apps/frontend/src/assets/icons/content/file/FileIcon.jsx',
  'apps/frontend/src/assets/icons/content/folder/FolderIcon.jsx',
  'apps/frontend/src/assets/icons/navigation/archive/ArchiveIcon.jsx',
  'apps/frontend/src/assets/icons/navigation/home/HomeIcon.jsx',
  'apps/frontend/src/assets/icons/navigation/settings/SettingsIcon.jsx',
  'apps/frontend/src/assets/icons/profile/profile/ProfileIcon.jsx',
  'apps/frontend/src/components/profile/profile-menu/ProfileMenu.jsx',
  'apps/frontend/src/components/error-boundary/AppErrorBoundary.jsx',
  'apps/frontend/src/components/profile/password-form/PasswordForm.jsx',
  'apps/frontend/src/components/navigation/BottomNavigation.jsx',
  'apps/frontend/src/components/top-bar/TopBar.jsx',
  'apps/frontend/src/screens/home/Home.jsx',
  'apps/frontend/src/screens/archive/root/ArchiveRoot.jsx',
  'apps/frontend/src/screens/archive/job/ArchiveJob.jsx',
  'apps/frontend/src/screens/archive/candidate/CandidateFiles.jsx',
  'apps/frontend/src/screens/workflow/StartWorkflow.jsx',
  'apps/frontend/src/screens/settings/Settings.jsx',
  'apps/frontend/src/screens/profile/sign-in/ProfileSignIn.jsx',
  'apps/frontend/src/domain/archive/archiveRecords.js',
  'apps/frontend/src/hooks/profile/useActiveProfile.js',
  'apps/frontend/src/services/auth/authService.js',
  'apps/frontend/src/services/api/apiClient.js',
  'apps/frontend/src/services/archive/archiveService.js',
  'apps/frontend/src/services/profile/profileService.js',
  'apps/frontend/src/services/supabase/client.js',
  'apps/frontend/src/styles/navigation/navigation.css',
  'apps/frontend/src/styles/profile/profile.css',
  'apps/frontend/test/archiveRecords.test.js',
  'apps/api/src/routes/profile.js',
  'apps/api/src/middleware/authenticateRequest.js',
  'apps/api/src/services/supabaseClient.js',
  'apps/api/test/authSecurity.test.js',
  'apps/api/test/interviewLifecycle.test.js',
  'apps/api/test/supabaseError.test.js',
  'apps/api/package.json'
];

let failed = false;
for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required file: ${file}`);
    failed = true;
  } else {
    console.log(`✓ ${file}`);
  }
}

if (failed) process.exit(1);
console.log('Repository structure check passed.');
