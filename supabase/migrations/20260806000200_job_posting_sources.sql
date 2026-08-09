alter table public.job_postings
add column source_type text not null default 'manual',
add column source_file_name text;

alter table public.interview_files
add column job_posting_id uuid;

update public.interviews as interviews
set job_posting_id = (
  select postings.id
  from public.job_postings as postings
  where postings.user_id = interviews.user_id
    and lower(postings.title) = lower(interviews.job_posting_title)
  order by postings.created_at, postings.id
  limit 1
)
where interviews.job_posting_id is null;

insert into public.job_postings (user_id, title, work_arrangement)
select distinct interviews.user_id, interviews.job_posting_title, 'Hybrid'
from public.interviews as interviews
where interviews.job_posting_id is null;

update public.interviews as interviews
set job_posting_id = (
  select postings.id
  from public.job_postings as postings
  where postings.user_id = interviews.user_id
    and lower(postings.title) = lower(interviews.job_posting_title)
  order by postings.created_at, postings.id
  limit 1
)
where interviews.job_posting_id is null;

alter table public.interviews
alter column job_posting_id set not null;

update public.interview_files as files
set job_posting_id = interviews.job_posting_id
from public.interviews as interviews
where files.interview_id = interviews.id
  and files.user_id = interviews.user_id
  and files.file_type = 'Job Posting';

update public.job_postings as postings
set source_type = 'upload',
    source_file_name = sources.name
from (
  select distinct on (files.job_posting_id, files.user_id)
    files.job_posting_id,
    files.user_id,
    files.name
  from public.interview_files as files
  where files.file_type = 'Job Posting'
    and files.job_posting_id is not null
  order by files.job_posting_id, files.user_id, files.created_at desc
) as sources
where postings.id = sources.job_posting_id
  and postings.user_id = sources.user_id;

alter table public.job_postings
add constraint job_postings_source_check check (
  (source_type = 'manual' and source_file_name is null)
  or (source_type = 'upload' and source_file_name is not null and char_length(source_file_name) between 1 and 255)
);

alter table public.interview_files
add constraint interview_files_job_posting_owner_fk
foreign key (job_posting_id, user_id)
references public.job_postings (id, user_id)
on delete restrict,
add constraint interview_files_job_posting_type_check check (
  (file_type = 'Job Posting' and job_posting_id is not null)
  or (file_type <> 'Job Posting' and job_posting_id is null)
);

create index interview_files_job_posting_idx
on public.interview_files (job_posting_id, user_id)
where job_posting_id is not null;

create or replace function public.link_job_posting_file()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.file_type <> 'Job Posting' then
    new.job_posting_id = null;
    return new;
  end if;

  select interviews.job_posting_id
  into new.job_posting_id
  from public.interviews as interviews
  where interviews.id = new.interview_id
    and interviews.user_id = new.user_id;

  if new.job_posting_id is null then
    raise exception 'The job posting upload is missing an owned position.' using errcode = '42501';
  end if;

  update public.job_postings
  set source_type = 'upload',
      source_file_name = new.name
  where id = new.job_posting_id
    and user_id = new.user_id;

  return new;
end;
$$;

create trigger interview_files_link_job_posting
before insert on public.interview_files
for each row execute function public.link_job_posting_file();

revoke all on function public.link_job_posting_file() from public;
