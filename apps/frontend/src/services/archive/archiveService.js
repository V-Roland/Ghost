import { groupInterviews, readableFileSize } from '../../domain/archive/archiveRecords.js';
import { apiRequest } from '../api/apiClient.js';

export async function loadArchive() {
  const { interviews } = await apiRequest('/api/archive/interviews');
  return groupInterviews(interviews);
}

export async function loadInterviewFiles(interviewId) {
  const { files } = await apiRequest(`/api/archive/interviews/${encodeURIComponent(interviewId)}/files`);
  return files.map((file) => ({ ...file, size: readableFileSize(file.sizeBytes) }));
}

export async function createInterview(draft) {
  const { interview } = await apiRequest('/api/interviews', {
    method: 'POST',
    body: JSON.stringify(draft)
  });
  return interview;
}
