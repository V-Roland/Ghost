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

function scopeQuery(scope = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(scope)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

function mapFiles(files) {
  return files.map((file) => ({ ...file, size: readableFileSize(file.sizeBytes) }));
}

export async function loadArchiveFolders(scope = {}) {
  const { folders } = await apiRequest(`/api/archive/folders${scopeQuery(scope)}`);
  return folders;
}

export async function loadInterviewDirectories(jobPostingId) {
  const query = jobPostingId ? `?jobPostingId=${encodeURIComponent(jobPostingId)}` : '';
  const { folders } = await apiRequest(`/api/archive/interview-directories${query}`);
  return folders;
}

export async function createArchiveFolder(folder) {
  const { folder: createdFolder } = await apiRequest('/api/archive/folders', {
    method: 'POST',
    body: JSON.stringify(folder)
  });
  return createdFolder;
}

export async function loadArchiveFolder(folderId) {
  const result = await apiRequest(`/api/archive/folders/${encodeURIComponent(folderId)}`);
  return { ...result, files: mapFiles(result.files) };
}

export async function moveArchiveFile(fileId, folderId) {
  const { file } = await apiRequest(`/api/archive/files/${encodeURIComponent(fileId)}/folder`, {
    method: 'PATCH',
    body: JSON.stringify({ folderId })
  });
  return { ...file, size: readableFileSize(file.sizeBytes) };
}

export async function loadExportManifest(scope = {}) {
  const { manifest } = await apiRequest(`/api/archive/export${scopeQuery(scope)}`);
  return manifest;
}

export async function createInterview(draft) {
  const { interview } = await apiRequest('/api/interviews', {
    method: 'POST',
    body: JSON.stringify(draft)
  });
  return interview;
}
