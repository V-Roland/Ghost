alter table public.interviews
add constraint interviews_folder_scope_key unique (id, job_posting_id, user_id);

create table public.archive_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_posting_id uuid,
  interview_id uuid,
  parent_folder_id uuid,
  name text not null check (
    char_length(name) between 1 and 120
    and name not in ('.', '..')
    and name !~ '[\\/:*?"<>|]'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (job_posting_id, user_id) references public.job_postings (id, user_id) on delete cascade,
  foreign key (interview_id, job_posting_id, user_id)
    references public.interviews (id, job_posting_id, user_id) on delete cascade,
  foreign key (parent_folder_id, user_id) references public.archive_folders (id, user_id) on delete cascade,
  check (interview_id is null or job_posting_id is not null)
);

alter table public.interview_files
add column folder_id uuid,
add constraint interview_files_folder_owner_fk
foreign key (folder_id, user_id) references public.archive_folders (id, user_id) on delete restrict;

create index archive_folders_scope_idx
on public.archive_folders (user_id, job_posting_id, interview_id, parent_folder_id, name);

create index interview_files_folder_idx
on public.interview_files (folder_id, user_id)
where folder_id is not null;

create trigger archive_folders_set_updated_at
before update on public.archive_folders
for each row execute function public.set_updated_at();

alter table public.archive_folders enable row level security;
alter table public.archive_folders force row level security;

create policy "Users can manage own archive folders"
on public.archive_folders for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.archive_folders from anon;
grant select, insert, update, delete on table public.archive_folders to authenticated;

create or replace function public.create_archive_folder(
  p_name text,
  p_job_posting_id uuid,
  p_interview_id uuid,
  p_parent_folder_id uuid
)
returns setof public.archive_folders
language plpgsql
set search_path = ''
as $$
declare
  owner_user_id uuid := auth.uid();
  resolved_job_posting_id uuid := p_job_posting_id;
  parent_folder public.archive_folders%rowtype;
  created_folder public.archive_folders%rowtype;
  normalized_name text := trim(p_name);
begin
  if owner_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if normalized_name = '' or char_length(normalized_name) > 120
    or normalized_name in ('.', '..') or normalized_name ~ '[\\/:*?"<>|]' then
    raise exception 'Folder name is invalid.' using errcode = '22023';
  end if;

  if p_interview_id is not null then
    select interviews.job_posting_id
    into resolved_job_posting_id
    from public.interviews as interviews
    where interviews.id = p_interview_id
      and interviews.user_id = owner_user_id;
    if resolved_job_posting_id is null then
      raise exception 'The interview folder scope is unavailable.' using errcode = '42501';
    end if;
    if p_job_posting_id is not null and p_job_posting_id <> resolved_job_posting_id then
      raise exception 'The interview does not belong to that position.' using errcode = '42501';
    end if;
  elsif p_job_posting_id is not null and not exists (
    select 1 from public.job_postings
    where id = p_job_posting_id and user_id = owner_user_id
  ) then
    raise exception 'The position folder scope is unavailable.' using errcode = '42501';
  end if;

  if p_parent_folder_id is not null then
    select * into parent_folder
    from public.archive_folders
    where id = p_parent_folder_id and user_id = owner_user_id;
    if parent_folder.id is null
      or parent_folder.job_posting_id is distinct from resolved_job_posting_id
      or parent_folder.interview_id is distinct from p_interview_id then
      raise exception 'The parent folder is outside this archive scope.' using errcode = '42501';
    end if;
  end if;

  if exists (
    select 1 from public.archive_folders
    where user_id = owner_user_id
      and job_posting_id is not distinct from resolved_job_posting_id
      and interview_id is not distinct from p_interview_id
      and parent_folder_id is not distinct from p_parent_folder_id
      and lower(name) = lower(normalized_name)
  ) then
    raise exception 'A folder with that name already exists here.' using errcode = '23505';
  end if;

  insert into public.archive_folders (
    user_id, job_posting_id, interview_id, parent_folder_id, name
  ) values (
    owner_user_id, resolved_job_posting_id, p_interview_id, p_parent_folder_id, normalized_name
  ) returning * into created_folder;

  return next created_folder;
end;
$$;

create or replace function public.validate_interview_file_folder()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  folder_interview_id uuid;
begin
  if new.folder_id is null then
    return new;
  end if;

  select folders.interview_id
  into folder_interview_id
  from public.archive_folders as folders
  where folders.id = new.folder_id
    and folders.user_id = new.user_id;

  if folder_interview_id is null or folder_interview_id <> new.interview_id then
    raise exception 'Files can only be placed in a folder for the same interview.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger interview_files_validate_folder
before insert or update of folder_id, interview_id on public.interview_files
for each row execute function public.validate_interview_file_folder();

revoke all on function public.create_archive_folder(text, uuid, uuid, uuid) from public;
grant execute on function public.create_archive_folder(text, uuid, uuid, uuid) to authenticated;
revoke all on function public.validate_interview_file_folder() from public;
