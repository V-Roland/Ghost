import 'dotenv/config';

export function requireSupabaseAdminConfiguration() {
  const missing = [];
  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length) {
    throw new Error(`Missing required Supabase environment variables: ${missing.join(', ')}.`);
  }
}

export function requireSupabaseClientConfiguration() {
  const missing = [];
  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_PUBLISHABLE_KEY) missing.push('SUPABASE_PUBLISHABLE_KEY');
  if (missing.length) {
    throw new Error(`Missing required Supabase environment variables: ${missing.join(', ')}.`);
  }
}

export function assertDemoSeedTarget() {
  const url = new URL(process.env.SUPABASE_URL);
  const localTarget = ['127.0.0.1', 'localhost'].includes(url.hostname);
  if (process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Set ALLOW_DEMO_SEED=true before creating demo users and records.');
  }
  if (!localTarget && process.env.ALLOW_REMOTE_DEMO_SEED !== 'true') {
    throw new Error('Remote demo seeding is blocked. Set ALLOW_REMOTE_DEMO_SEED=true only for a disposable development project.');
  }
}

export function assertRlsTestTarget() {
  const url = new URL(process.env.SUPABASE_URL);
  const localTarget = ['127.0.0.1', 'localhost'].includes(url.hostname);
  if (process.env.ALLOW_RLS_TESTS !== 'true') {
    throw new Error('Set ALLOW_RLS_TESTS=true before running the two-user isolation test.');
  }
  if (!localTarget && process.env.ALLOW_REMOTE_RLS_TESTS !== 'true') {
    throw new Error('Remote RLS tests are blocked. Set ALLOW_REMOTE_RLS_TESTS=true only for a disposable development project.');
  }
}
