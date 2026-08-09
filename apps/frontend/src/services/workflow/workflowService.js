import { interviewSubmission } from '../../domain/workflow/interviewDraft.js';
import { createInterview } from '../archive/archiveService.js';
import {
  createUploadUuid,
  removeStagedInterviewFiles,
  stageInterviewFiles
} from '../uploads/interviewUploadService.js';

export async function createInterviewWorkspace(draft) {
  const interviewId = createUploadUuid();
  const stagedFiles = await stageInterviewFiles(interviewId, draft.files);
  try {
    return await createInterview(interviewSubmission(draft, interviewId, stagedFiles));
  } catch (error) {
    await removeStagedInterviewFiles(stagedFiles).catch(() => undefined);
    throw error;
  }
}
