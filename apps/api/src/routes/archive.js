import express from 'express';
import { archiveFolderRecord, fileRecord, interviewRecord } from '../lib/apiRecords.js';
import { normalizeArchiveFileMove, normalizeArchiveFolder, optionalArchiveUuid } from '../lib/archiveFolders.js';
import { buildArchiveManifest } from '../lib/archiveManifest.js';
import { HttpError } from '../lib/httpError.js';
import { throwIfSupabaseError } from '../lib/supabaseError.js';

export const archiveRouter = express.Router();

function folderSelect() {
  return 'id,user_id,job_posting_id,interview_id,parent_folder_id,name,created_at,updated_at';
}

function fileSelect() {
  return 'id,user_id,interview_id,job_posting_id,folder_id,name,file_type,size_bytes,storage_object_path,created_at,updated_at';
}

function interviewSelect() {
  return 'id,user_id,job_posting_id,job_posting_title,candidate_name,interview_date,status,archive_path,archive_folder_id,tags,signal_level,created_at,updated_at,job_posting:job_postings(id,title,department,location,work_arrangement,description,source_type,source_file_name)';
}

archiveRouter.get('/folders', async (req, res, next) => {
  try {
    const allowedQuery = new Set(['jobPostingId', 'interviewId', 'parentFolderId']);
    const unsupportedQuery = Object.keys(req.query).find((key) => !allowedQuery.has(key));
    if (unsupportedQuery) throw new HttpError(400, 'INVALID_REQUEST', `Unsupported folder query: ${unsupportedQuery}.`);
    const jobPostingId = optionalArchiveUuid(req.query.jobPostingId, 'jobPostingId');
    const interviewId = optionalArchiveUuid(req.query.interviewId, 'interviewId');
    const parentFolderId = optionalArchiveUuid(req.query.parentFolderId, 'parentFolderId');
    let query = req.supabase.from('archive_folders').select(folderSelect()).eq('user_id', req.auth.userId);
    query = jobPostingId ? query.eq('job_posting_id', jobPostingId) : query.is('job_posting_id', null);
    query = interviewId ? query.eq('interview_id', interviewId) : query.is('interview_id', null);
    query = parentFolderId ? query.eq('parent_folder_id', parentFolderId) : query.is('parent_folder_id', null);
    const { data, error } = await query.order('name');
    throwIfSupabaseError(error);
    res.json({ folders: data.map(archiveFolderRecord) });
  } catch (error) {
    next(error);
  }
});

archiveRouter.post('/folders', async (req, res, next) => {
  try {
    const input = normalizeArchiveFolder(req.body);
    const { data, error } = await req.supabase.rpc('create_archive_folder', {
      p_name: input.name,
      p_job_posting_id: input.jobPostingId,
      p_interview_id: input.interviewId,
      p_parent_folder_id: input.parentFolderId
    }).single();
    throwIfSupabaseError(error);
    res.status(201).json({ folder: archiveFolderRecord(data) });
  } catch (error) {
    next(error);
  }
});

archiveRouter.get('/interview-directories', async (req, res, next) => {
  try {
    const allowedQuery = new Set(['jobPostingId']);
    const unsupportedQuery = Object.keys(req.query).find((key) => !allowedQuery.has(key));
    if (unsupportedQuery) throw new HttpError(400, 'INVALID_REQUEST', `Unsupported directory query: ${unsupportedQuery}.`);
    const jobPostingId = optionalArchiveUuid(req.query.jobPostingId, 'jobPostingId');
    let query = req.supabase
      .from('archive_folders')
      .select(folderSelect())
      .eq('user_id', req.auth.userId)
      .is('interview_id', null);
    query = jobPostingId
      ? query.or(`job_posting_id.is.null,job_posting_id.eq.${jobPostingId}`)
      : query.is('job_posting_id', null);
    const { data, error } = await query.order('name');
    throwIfSupabaseError(error);
    res.json({ folders: data.map(archiveFolderRecord) });
  } catch (error) {
    next(error);
  }
});

archiveRouter.get('/folders/:folderId', async (req, res, next) => {
  try {
    const folderId = optionalArchiveUuid(req.params.folderId, 'folderId');
    const { data: folder, error: folderError } = await req.supabase
      .from('archive_folders').select(folderSelect()).eq('id', folderId).eq('user_id', req.auth.userId).single();
    throwIfSupabaseError(folderError);
    const [
      { data: folders, error: foldersError },
      { data: files, error: filesError },
      { data: interviews, error: interviewsError }
    ] = await Promise.all([
      req.supabase.from('archive_folders').select(folderSelect()).eq('parent_folder_id', folderId).eq('user_id', req.auth.userId).order('name'),
      req.supabase.from('interview_files').select(fileSelect()).eq('folder_id', folderId).eq('user_id', req.auth.userId).order('name'),
      req.supabase.from('interviews').select(interviewSelect()).eq('archive_folder_id', folderId).eq('user_id', req.auth.userId).order('updated_at', { ascending: false })
    ]);
    throwIfSupabaseError(foldersError);
    throwIfSupabaseError(filesError);
    throwIfSupabaseError(interviewsError);
    res.json({
      folder: archiveFolderRecord(folder),
      folders: folders.map(archiveFolderRecord),
      files: files.map(fileRecord),
      interviews: interviews.map(interviewRecord)
    });
  } catch (error) {
    next(error);
  }
});

archiveRouter.patch('/files/:fileId/folder', async (req, res, next) => {
  try {
    const fileId = optionalArchiveUuid(req.params.fileId, 'fileId');
    if (!fileId) throw new HttpError(400, 'INVALID_REQUEST', 'fileId is required.');
    const input = normalizeArchiveFileMove(req.body);
    const { data, error } = await req.supabase
      .from('interview_files')
      .update({ folder_id: input.folderId })
      .eq('id', fileId)
      .eq('user_id', req.auth.userId)
      .select(fileSelect())
      .single();
    throwIfSupabaseError(error);
    res.json({ file: fileRecord(data) });
  } catch (error) {
    next(error);
  }
});

archiveRouter.get('/export', async (req, res, next) => {
  try {
    const allowedQuery = new Set(['jobPostingId', 'interviewId', 'folderId']);
    const unsupportedQuery = Object.keys(req.query).find((key) => !allowedQuery.has(key));
    if (unsupportedQuery) throw new HttpError(400, 'INVALID_REQUEST', `Unsupported export query: ${unsupportedQuery}.`);
    const suppliedScopes = ['jobPostingId', 'interviewId', 'folderId'].filter((key) => req.query[key]);
    if (suppliedScopes.length > 1) throw new HttpError(400, 'INVALID_REQUEST', 'Export accepts only one archive scope.');
    const scope = {
      jobPostingId: optionalArchiveUuid(req.query.jobPostingId, 'jobPostingId'),
      interviewId: optionalArchiveUuid(req.query.interviewId, 'interviewId'),
      folderId: optionalArchiveUuid(req.query.folderId, 'folderId')
    };
    const [{ data: interviews, error: interviewsError }, { data: folders, error: foldersError }, { data: files, error: filesError }] = await Promise.all([
      req.supabase.from('interviews').select('id,job_posting_id,job_posting_title,candidate_name,interview_date,archive_folder_id').eq('user_id', req.auth.userId),
      req.supabase.from('archive_folders').select(folderSelect()).eq('user_id', req.auth.userId),
      req.supabase.from('interview_files').select(fileSelect()).eq('user_id', req.auth.userId)
    ]);
    throwIfSupabaseError(interviewsError);
    throwIfSupabaseError(foldersError);
    throwIfSupabaseError(filesError);
    const manifest = buildArchiveManifest(
      interviews.map((interview) => ({
        id: interview.id,
        jobPostingId: interview.job_posting_id,
        jobPostingTitle: interview.job_posting_title,
        candidateName: interview.candidate_name,
        interviewDate: interview.interview_date,
        archiveFolderId: interview.archive_folder_id
      })),
      folders.map(archiveFolderRecord),
      files.map(fileRecord),
      scope
    );
    res.json({ manifest });
  } catch (error) {
    next(error);
  }
});

archiveRouter.get('/interviews', async (req, res, next) => {
  try {
    const { data, error } = await req.supabase
      .from('interviews')
      .select(interviewSelect())
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
      .select(fileSelect())
      .eq('user_id', req.auth.userId)
      .eq('interview_id', req.params.interviewId)
      .order('name');
    throwIfSupabaseError(error);
    res.json({ files: data.map(fileRecord) });
  } catch (error) {
    next(error);
  }
});
