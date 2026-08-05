create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  role text not null default 'Interviewer' check (char_length(role) between 1 and 80),
  theme_preference text not null default 'dark' check (theme_preference in ('dark', 'light', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  department text check (department is null or char_length(department) <= 120),
  location text check (location is null or char_length(location) <= 160),
  description text,
  required_skills text[] not null default '{}',
  seniority text check (seniority is null or char_length(seniority) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.interviewees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text check (email is null or char_length(email) <= 320),
  current_title text check (current_title is null or char_length(current_title) <= 120),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_posting_id uuid,
  interviewee_id uuid,
  job_posting_title text not null check (char_length(job_posting_title) between 1 and 160),
  candidate_name text not null check (char_length(candidate_name) between 1 and 120),
  interview_date date not null default current_date,
  status text not null default 'Draft' check (status in ('Draft', 'UploadsComplete', 'QuestionsReady', 'InInterview', 'Completed', 'Archived')),
  archive_path text not null check (char_length(archive_path) between 1 and 400),
  tags text[] not null default '{}',
  signal_level text not null default 'None' check (char_length(signal_level) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, archive_path),
  foreign key (job_posting_id, user_id) references public.job_postings (id, user_id) on delete restrict,
  foreign key (interviewee_id, user_id) references public.interviewees (id, user_id) on delete restrict
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  interview_id uuid not null,
  name text not null check (char_length(name) between 1 and 255),
  document_type text not null check (char_length(document_type) between 1 and 80),
  content_type text check (content_type is null or char_length(content_type) <= 160),
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  storage_object_path text not null check (storage_object_path like (user_id::text || '/%')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (interview_id, user_id) references public.interviews (id, user_id) on delete cascade
);

create table public.supplemental_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  interview_id uuid not null,
  label text not null check (char_length(label) between 1 and 120),
  url text not null check (char_length(url) between 1 and 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (interview_id, user_id) references public.interviews (id, user_id) on delete cascade
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  interview_id uuid not null,
  position integer not null check (position >= 0),
  prompt text not null check (char_length(prompt) between 1 and 4000),
  source text not null default 'manual' check (source in ('manual', 'generated', 'imported')),
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, interview_id, user_id),
  unique (interview_id, user_id, position),
  foreign key (interview_id, user_id) references public.interviews (id, user_id) on delete cascade
);

create table public.question_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  interview_id uuid not null,
  question_id uuid not null,
  response_text text,
  interviewer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (question_id, interview_id, user_id),
  foreign key (question_id, interview_id, user_id) references public.questions (id, interview_id, user_id) on delete cascade
);

create table public.integrity_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  interview_id uuid not null,
  signal_type text not null check (char_length(signal_type) between 1 and 120),
  level text not null check (level in ('Info', 'Review', 'Elevated')),
  evidence jsonb not null default '{}'::jsonb,
  review_status text not null default 'Pending' check (review_status in ('Pending', 'Reviewed', 'Dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (interview_id, user_id) references public.interviews (id, user_id) on delete cascade
);

create table public.interview_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  interview_id uuid not null,
  name text not null check (char_length(name) between 1 and 255),
  file_type text not null check (char_length(file_type) between 1 and 80),
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  storage_object_path text not null check (storage_object_path like (user_id::text || '/%')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (interview_id, user_id) references public.interviews (id, user_id) on delete cascade
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  interview_id uuid not null,
  status text not null default 'Draft' check (status in ('Draft', 'Ready', 'Approved', 'Archived')),
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (interview_id, user_id) references public.interviews (id, user_id) on delete cascade
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  interview_id uuid not null,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (interview_id, user_id, name),
  foreign key (interview_id, user_id) references public.interviews (id, user_id) on delete cascade
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 120),
  entity_type text not null check (char_length(entity_type) between 1 and 120),
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index job_postings_user_id_idx on public.job_postings (user_id);
create index interviewees_user_id_idx on public.interviewees (user_id);
create index interviews_user_updated_idx on public.interviews (user_id, updated_at desc);
create index interviews_job_posting_idx on public.interviews (job_posting_id, user_id);
create index interviews_interviewee_idx on public.interviews (interviewee_id, user_id);
create index documents_interview_idx on public.documents (interview_id, user_id);
create index supplemental_links_interview_idx on public.supplemental_links (interview_id, user_id);
create index questions_interview_idx on public.questions (interview_id, user_id, position);
create index question_responses_interview_idx on public.question_responses (interview_id, user_id);
create index integrity_signals_interview_idx on public.integrity_signals (interview_id, user_id);
create index interview_files_interview_idx on public.interview_files (interview_id, user_id, name);
create index reports_interview_idx on public.reports (interview_id, user_id);
create index tags_interview_idx on public.tags (interview_id, user_id);
create index audit_events_user_created_idx on public.audit_events (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger job_postings_set_updated_at before update on public.job_postings for each row execute function public.set_updated_at();
create trigger interviewees_set_updated_at before update on public.interviewees for each row execute function public.set_updated_at();
create trigger interviews_set_updated_at before update on public.interviews for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.documents for each row execute function public.set_updated_at();
create trigger supplemental_links_set_updated_at before update on public.supplemental_links for each row execute function public.set_updated_at();
create trigger questions_set_updated_at before update on public.questions for each row execute function public.set_updated_at();
create trigger question_responses_set_updated_at before update on public.question_responses for each row execute function public.set_updated_at();
create trigger integrity_signals_set_updated_at before update on public.integrity_signals for each row execute function public.set_updated_at();
create trigger interview_files_set_updated_at before update on public.interview_files for each row execute function public.set_updated_at();
create trigger reports_set_updated_at before update on public.reports for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Ghost User'),
    'Interviewer'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name, role)
select
  users.id,
  coalesce(nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''), split_part(users.email, '@', 1), 'Ghost User'),
  'Interviewer'
from auth.users as users
on conflict (id) do nothing;

create or replace function public.record_interview_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events (user_id, event_type, entity_type, entity_id, details)
    values (new.user_id, 'InterviewCreated', 'Interview', new.id, jsonb_build_object('status', new.status));
  elsif new.status is distinct from old.status then
    insert into public.audit_events (user_id, event_type, entity_type, entity_id, details)
    values (
      new.user_id,
      'InterviewStatusChanged',
      'Interview',
      new.id,
      jsonb_build_object('fromStatus', old.status, 'toStatus', new.status)
    );
  end if;
  return new;
end;
$$;

create or replace function public.record_profile_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (user_id, event_type, entity_type, entity_id, details)
  values (new.id, 'ProfileUpdated', 'User', new.id, '{}'::jsonb);
  return new;
end;
$$;

create trigger interviews_record_audit
after insert or update of status on public.interviews
for each row execute function public.record_interview_audit_event();

create trigger profiles_record_audit
after update on public.profiles
for each row execute function public.record_profile_audit_event();

revoke all on function public.set_updated_at() from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.record_interview_audit_event() from public;
revoke all on function public.record_profile_audit_event() from public;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy "Users can read own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "Users can update own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'job_postings', 'interviewees', 'interviews', 'documents', 'supplemental_links',
    'questions', 'question_responses', 'integrity_signals', 'interview_files',
    'reports', 'tags'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      'Users can manage own rows',
      table_name
    );
  end loop;
end;
$$;

alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

create policy "Users can read own audit events"
on public.audit_events for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on table
  public.job_postings,
  public.interviewees,
  public.interviews,
  public.documents,
  public.supplemental_links,
  public.questions,
  public.question_responses,
  public.integrity_signals,
  public.interview_files,
  public.reports,
  public.tags
to authenticated;

grant select, update on table public.profiles to authenticated;
grant select on table public.audit_events to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('interview-files', 'interview-files', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

create policy "Users can read own interview files"
on storage.objects for select to authenticated
using (
  bucket_id = 'interview-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can upload own interview files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'interview-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can update own interview files"
on storage.objects for update to authenticated
using (
  bucket_id = 'interview-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'interview-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete own interview files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'interview-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
