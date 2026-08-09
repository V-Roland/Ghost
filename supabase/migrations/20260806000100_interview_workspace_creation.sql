alter table public.job_postings
add column work_arrangement text not null default 'Hybrid'
check (work_arrangement in ('Hybrid', 'Remote', 'In-Person'));

alter table public.interviews
add column resume_notes text,
add column processing_notes text,
add column supplement_notes text;

create or replace function public.create_interview_workspace(
  p_interview_id uuid,
  p_job_posting_id uuid,
  p_job_posting_title text,
  p_department text,
  p_location text,
  p_work_arrangement text,
  p_job_description text,
  p_candidate_name text,
  p_candidate_email text,
  p_candidate_current_title text,
  p_candidate_notes text,
  p_interview_date date,
  p_archive_path text,
  p_resume_notes text,
  p_processing_notes text,
  p_supplement_notes text,
  p_supplemental_links jsonb,
  p_questions jsonb,
  p_files jsonb,
  p_tags text[]
)
returns setof public.interviews
language plpgsql
set search_path = ''
as $$
declare
  owner_user_id uuid := auth.uid();
  workspace_id uuid := coalesce(p_interview_id, extensions.gen_random_uuid());
  selected_job public.job_postings%rowtype;
  selected_interviewee public.interviewees%rowtype;
  created_interview public.interviews%rowtype;
  item jsonb;
  item_position bigint;
begin
  if owner_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if nullif(trim(p_job_posting_title), '') is null or nullif(trim(p_candidate_name), '') is null then
    raise exception 'Position title and candidate name are required.' using errcode = '22023';
  end if;
  if p_work_arrangement not in ('Hybrid', 'Remote', 'In-Person') then
    raise exception 'Unsupported work arrangement.' using errcode = '22023';
  end if;

  if p_job_posting_id is null then
    insert into public.job_postings (
      user_id, title, department, location, work_arrangement, description
    ) values (
      owner_user_id,
      trim(p_job_posting_title),
      nullif(trim(p_department), ''),
      nullif(trim(p_location), ''),
      p_work_arrangement,
      nullif(trim(p_job_description), '')
    ) returning * into selected_job;
  else
    update public.job_postings
    set department = nullif(trim(p_department), ''),
        location = nullif(trim(p_location), ''),
        work_arrangement = p_work_arrangement,
        description = nullif(trim(p_job_description), '')
    where id = p_job_posting_id and user_id = owner_user_id
    returning * into selected_job;
    if selected_job.id is null then
      raise exception 'The selected position is not available.' using errcode = '42501';
    end if;
    if selected_job.title <> trim(p_job_posting_title) then
      raise exception 'The selected position title does not match.' using errcode = '22023';
    end if;
  end if;

  insert into public.interviewees (user_id, full_name, email, current_title, notes)
  values (
    owner_user_id,
    trim(p_candidate_name),
    nullif(trim(p_candidate_email), ''),
    nullif(trim(p_candidate_current_title), ''),
    nullif(trim(p_candidate_notes), '')
  ) returning * into selected_interviewee;

  insert into public.interviews (
    id, user_id, job_posting_id, interviewee_id, job_posting_title, candidate_name,
    interview_date, archive_path, resume_notes, processing_notes, supplement_notes, tags
  ) values (
    workspace_id,
    owner_user_id,
    selected_job.id,
    selected_interviewee.id,
    selected_job.title,
    selected_interviewee.full_name,
    p_interview_date,
    trim(p_archive_path),
    nullif(trim(p_resume_notes), ''),
    nullif(trim(p_processing_notes), ''),
    nullif(trim(p_supplement_notes), ''),
    coalesce(p_tags, '{}')
  ) returning * into created_interview;

  if jsonb_typeof(coalesce(p_supplemental_links, '[]'::jsonb)) <> 'array' then
    raise exception 'Supplemental links must be an array.' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(coalesce(p_supplemental_links, '[]'::jsonb))
  loop
    insert into public.supplemental_links (user_id, interview_id, label, url)
    values (owner_user_id, workspace_id, trim(item ->> 'label'), trim(item ->> 'url'));
  end loop;

  if jsonb_typeof(coalesce(p_questions, '[]'::jsonb)) <> 'array' then
    raise exception 'Questions must be an array.' using errcode = '22023';
  end if;
  for item, item_position in
    select value, ordinality - 1 from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) with ordinality
  loop
    insert into public.questions (user_id, interview_id, position, prompt, source, approved)
    values (owner_user_id, workspace_id, item_position, trim(item ->> 'prompt'), 'manual', true);
  end loop;

  if jsonb_typeof(coalesce(p_files, '[]'::jsonb)) <> 'array' then
    raise exception 'Files must be an array.' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(coalesce(p_files, '[]'::jsonb))
  loop
    if (item ->> 'storageObjectPath') not like (owner_user_id::text || '/' || workspace_id::text || '/%') then
      raise exception 'File path is outside the authenticated workspace.' using errcode = '42501';
    end if;
    insert into public.interview_files (user_id, interview_id, name, file_type, size_bytes, storage_object_path)
    values (
      owner_user_id,
      workspace_id,
      trim(item ->> 'name'),
      trim(item ->> 'fileType'),
      (item ->> 'sizeBytes')::bigint,
      item ->> 'storageObjectPath'
    );
  end loop;

  return next created_interview;
end;
$$;

revoke all on function public.create_interview_workspace(uuid, uuid, text, text, text, text, text, text, text, text, text, date, text, text, text, text, jsonb, jsonb, jsonb, text[]) from public;
grant execute on function public.create_interview_workspace(uuid, uuid, text, text, text, text, text, text, text, text, text, date, text, text, text, text, jsonb, jsonb, jsonb, text[]) to authenticated;
