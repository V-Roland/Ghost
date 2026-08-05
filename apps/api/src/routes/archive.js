import express from 'express';
import { fileRecord, interviewRecord } from '../lib/apiRecords.js';
import { throwIfSupabaseError } from '../lib/supabaseError.js';

export const archiveRouter = express.Router();

archiveRouter.get('/interviews', async (req, res, next) => {
  try {
    const { data, error } = await req.supabase
      .from('interviews')
      .select('id,user_id,job_posting_title,candidate_name,interview_date,status,archive_path,tags,signal_level,created_at,updated_at')
      .eq('user_id', req.auth.userId)
      .order('updated_at', { ascending: false });
    throwIfSupabaseError(error);
    res.json({ interviews: data.map(interviewRecord) });
  } catch (error) {
    next(error);
  }
});

archiveRouter.get('/interviews/:interviewId/files', async (req, res, next) => {
  try {
    const { data, error } = await req.supabase
      .from('interview_files')
      .select('id,user_id,interview_id,name,file_type,size_bytes,storage_object_path,created_at,updated_at')
      .eq('user_id', req.auth.userId)
      .eq('interview_id', req.params.interviewId)
      .order('name');
    throwIfSupabaseError(error);
    res.json({ files: data.map(fileRecord) });
  } catch (error) {
    next(error);
  }
});
