import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260805000100_ghost_schema.sql', 'utf8').toLowerCase();
const workspaceMigration = fs.readFileSync('supabase/migrations/20260806000100_interview_workspace_creation.sql', 'utf8').toLowerCase();
const postingSourceMigration = fs.readFileSync('supabase/migrations/20260806000200_job_posting_sources.sql', 'utf8').toLowerCase();
const archiveFoldersMigration = fs.readFileSync('supabase/migrations/20260806000300_archive_folders.sql', 'utf8').toLowerCase();
const interviewDirectoryMigration = fs.readFileSync('supabase/migrations/20260807000100_interview_directory_placement.sql', 'utf8').toLowerCase();
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

test('creates interview workspaces transactionally under the authenticated owner', () => {
  assert.match(workspaceMigration, /create or replace function public\.create_interview_workspace/);
  assert.match(workspaceMigration, /owner_user_id uuid := auth\.uid\(\)/);
  assert.match(workspaceMigration, /where id = p_job_posting_id and user_id = owner_user_id/);
  assert.match(workspaceMigration, /insert into public\.interviewees/);
  assert.match(workspaceMigration, /insert into public\.interviews/);
  assert.match(workspaceMigration, /insert into public\.supplemental_links/);
  assert.match(workspaceMigration, /insert into public\.questions/);
  assert.match(workspaceMigration, /insert into public\.interview_files/);
  assert.match(workspaceMigration, /owner_user_id::text \|\| '\/' \|\| workspace_id::text/);
  assert.match(workspaceMigration, /grant execute on function public\.create_interview_workspace/);
  assert.doesNotMatch(workspaceMigration, /security definer/);
});

test('adds structured position and interviewer note fields', () => {
  assert.match(workspaceMigration, /add column work_arrangement text not null/);
  assert.match(workspaceMigration, /'hybrid', 'remote', 'in-person'/);
  assert.match(workspaceMigration, /add column resume_notes text/);
  assert.match(workspaceMigration, /add column processing_notes text/);
  assert.match(workspaceMigration, /add column supplement_notes text/);
});

test('links uploaded job postings to owned position records', () => {
  assert.match(postingSourceMigration, /add column source_type text not null default 'manual'/);
  assert.match(postingSourceMigration, /add column job_posting_id uuid/);
  assert.match(postingSourceMigration, /alter column job_posting_id set not null/);
  assert.match(postingSourceMigration, /where interviews\.job_posting_id is null/);
  assert.match(postingSourceMigration, /foreign key \(job_posting_id, user_id\)/);
  assert.match(postingSourceMigration, /references public\.job_postings \(id, user_id\)/);
  assert.match(postingSourceMigration, /create or replace function public\.link_job_posting_file/);
  assert.match(postingSourceMigration, /where interviews\.id = new\.interview_id/);
  assert.match(postingSourceMigration, /and interviews\.user_id = new\.user_id/);
  assert.match(postingSourceMigration, /set source_type = 'upload'/);
  assert.doesNotMatch(postingSourceMigration, /security definer/);
});

test('creates literal owner-scoped archive folders and file placement constraints', () => {
  assert.match(archiveFoldersMigration, /create table public\.archive_folders/);
  assert.match(archiveFoldersMigration, /user_id uuid not null default auth\.uid\(\)/);
  assert.match(archiveFoldersMigration, /foreign key \(interview_id, job_posting_id, user_id\)/);
  assert.match(archiveFoldersMigration, /foreign key \(parent_folder_id, user_id\)/);
  assert.match(archiveFoldersMigration, /add column folder_id uuid/);
  assert.match(archiveFoldersMigration, /alter table public\.archive_folders enable row level security/);
  assert.match(archiveFoldersMigration, /alter table public\.archive_folders force row level security/);
  assert.match(archiveFoldersMigration, /using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(archiveFoldersMigration, /with check \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(archiveFoldersMigration, /create or replace function public\.create_archive_folder/);
  assert.match(archiveFoldersMigration, /create or replace function public\.validate_interview_file_folder/);
  assert.doesNotMatch(archiveFoldersMigration, /security definer/);
});

test('places interviews in owner-scoped archive directories', () => {
  assert.match(interviewDirectoryMigration, /add column archive_folder_id uuid/);
  assert.match(interviewDirectoryMigration, /foreign key \(archive_folder_id, user_id\)/);
  assert.match(interviewDirectoryMigration, /on delete set null \(archive_folder_id\)/);
  assert.match(interviewDirectoryMigration, /create or replace function public\.validate_interview_archive_folder/);
  assert.match(interviewDirectoryMigration, /selected_job_posting_id <> new\.job_posting_id/);
  assert.match(interviewDirectoryMigration, /p_archive_folder_id uuid/);
  assert.match(interviewDirectoryMigration, /owner_user_id uuid := auth\.uid\(\)/);
  assert.match(interviewDirectoryMigration, /grant execute on function public\.create_interview_workspace/);
  assert.doesNotMatch(interviewDirectoryMigration, /security definer/);
});
