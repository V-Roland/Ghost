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
      .from('interviews')
      .insert({
        job_posting_title: input.jobPostingTitle,
        candidate_name: input.candidateName,
        interview_date: input.interviewDate,
        archive_path: input.archivePath,
        tags: input.tags
      })
      .select('id,user_id,job_posting_title,candidate_name,interview_date,status,archive_path,tags,signal_level,created_at,updated_at')
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
