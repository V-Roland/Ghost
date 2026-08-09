import { HttpError } from './httpError.js';

const allowedFields = new Set(['name', 'jobPostingId', 'interviewId', 'parentFolderId']);
const allowedFileMoveFields = new Set(['folderId']);

export function optionalArchiveUuid(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, 'INVALID_REQUEST', `${fieldName} must be a valid UUID.`);
  }
  return value.toLowerCase();
}

export function normalizeArchiveFolder(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'INVALID_REQUEST', 'The folder request must be a JSON object.');
  }
  const unsupportedField = Object.keys(body).find((field) => !allowedFields.has(field));
  if (unsupportedField) throw new HttpError(400, 'INVALID_REQUEST', `Unsupported folder property: ${unsupportedField}.`);
  if (typeof body.name !== 'string' || !body.name.trim()) throw new HttpError(400, 'INVALID_REQUEST', 'Folder name is required.');
  const name = body.name.trim().replace(/\s+/g, ' ');
  if (name.length > 120 || ['.', '..'].includes(name) || /[\\/:*?"<>|]/.test(name)) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Folder name contains unsupported characters.');
  }
  return {
    name,
    jobPostingId: optionalArchiveUuid(body.jobPostingId, 'jobPostingId'),
    interviewId: optionalArchiveUuid(body.interviewId, 'interviewId'),
    parentFolderId: optionalArchiveUuid(body.parentFolderId, 'parentFolderId')
  };
}

export function normalizeArchiveFileMove(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'INVALID_REQUEST', 'The file move request must be a JSON object.');
  }
  const unsupportedField = Object.keys(body).find((field) => !allowedFileMoveFields.has(field));
  if (unsupportedField) throw new HttpError(400, 'INVALID_REQUEST', `Unsupported file move property: ${unsupportedField}.`);
  if (!Object.hasOwn(body, 'folderId')) throw new HttpError(400, 'INVALID_REQUEST', 'folderId is required.');
  return { folderId: optionalArchiveUuid(body.folderId, 'folderId') };
}
