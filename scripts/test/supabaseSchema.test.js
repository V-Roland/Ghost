import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260805000100_ghost_schema.sql', 'utf8').toLowerCase();
const ownedTables = [
  'job_postings', 'interviewees', 'interviews', 'documents', 'supplemental_links',
  'questions', 'question_responses', 'integrity_signals', 'interview_files', 'reports', 'tags'
];

test('creates every profile-owned table with a Supabase user owner', () => {
  for (const table of ownedTables) {
    assert.match(migration, new RegExp(`create table public\\.${table} \\(`));
    assert.match(migration, new RegExp(`'${table}'`));
  }
  assert.match(migration, /user_id uuid not null default auth\.uid\(\) references auth\.users/);
});

test('enables forced RLS and checks auth.uid for reads and writes', () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(migration, /with check \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(migration, /\(select auth\.uid\(\)\) = id/);
});

test('prevents cross-owner references and protects private storage paths', () => {
  assert.match(migration, /foreign key \(interview_id, user_id\) references public\.interviews \(id, user_id\)/);
  assert.match(migration, /foreign key \(job_posting_id, user_id\) references public\.job_postings \(id, user_id\)/);
  assert.match(migration, /values \('interview-files', 'interview-files', false/);
  assert.match(migration, /storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/);
});

test('keeps password storage in Supabase Auth and audit events append-only', () => {
  assert.doesNotMatch(migration, /password_hash|auth_credentials|auth_sessions/);
  assert.match(migration, /grant select on table public\.audit_events to authenticated/);
  assert.doesNotMatch(migration, /grant select, insert, update, delete on table public\.audit_events/);
});

test('creates and backfills one profile for every Auth user', () => {
  assert.match(migration, /create trigger on_auth_user_created/);
  assert.match(migration, /from auth\.users as users/);
  assert.match(migration, /on conflict \(id\) do nothing/);
});
