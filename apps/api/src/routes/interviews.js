import express from 'express';
import { interviewRecord } from '../lib/apiRecords.js';
import { normalizeNewInterview, validateStatusTransition } from '../lib/interviewLifecycle.js';
import { throwIfSupabaseError } from '../lib/supabaseError.js';

export const interviewsRouter = express.Router();

async function readInterview(req, interviewId) {
  const { data, error } = await req.supabase
    .from('interviews')
    .select('id,user_id,job_posting_title,candidate_name,interview_date,status,archive_path,tags,signal_level,created_at,updated_at')
    .eq('id', interviewId)
    .eq('user_id', req.auth.userId)
    .single();
  throwIfSupabaseError(error);
  return data;
}

interviewsRouter.post('/', async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const input = normalizeNewInterview(req.body, new Date(now));
    const { data, error } = await req.supabase
      .rpc('create_interview_workspace', {
        p_interview_id: input.interviewId,
        p_job_posting_id: input.jobPostingId,
        p_job_posting_title: input.jobPostingTitle,
        p_department: input.department,
        p_location: input.location,
        p_work_arrangement: input.workArrangement,
        p_job_description: input.jobDescription,
        p_candidate_name: input.candidateName,
        p_candidate_email: input.candidateEmail,
        p_candidate_current_title: input.candidateCurrentTitle,
        p_candidate_notes: input.candidateNotes,
        p_interview_date: input.interviewDate,
        p_archive_path: input.archivePath,
        p_archive_folder_id: input.archiveFolderId,
        p_resume_notes: input.resumeNotes,
        p_processing_notes: input.processingNotes,
        p_supplement_notes: input.supplementNotes,
        p_supplemental_links: input.supplementalLinks,
        p_questions: input.questions,
        p_files: input.files,
        p_tags: input.tags
      })
      .single();
    throwIfSupabaseError(error);
    res.status(201).json({ interview: interviewRecord(data) });
  } catch (error) {
    next(error);
  }
});

interviewsRouter.patch('/:interviewId/status', async (req, res, next) => {
  try {
    const requestedStatus = req.body?.status;
    const interview = await readInterview(req, req.params.interviewId);
    const changed = validateStatusTransition(interview.status, requestedStatus);

    if (!changed) {
      return res.json({ interview: interviewRecord(interview), changed: false });
    }

    const { data, error } = await req.supabase
      .from('interviews')
      .update({ status: requestedStatus })
      .eq('id', interview.id)
      .eq('user_id', req.auth.userId)
      .eq('status', interview.status)
      .select('id,user_id,job_posting_title,candidate_name,interview_date,status,archive_path,tags,signal_level,created_at,updated_at')
      .single();
    throwIfSupabaseError(error);
    return res.json({ interview: interviewRecord(data), changed: true });
  } catch (error) {
    next(error);
  }
});
