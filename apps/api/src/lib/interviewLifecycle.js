import { HttpError } from './httpError.js';

export const INTERVIEW_STATUSES = Object.freeze(['Draft', 'UploadsComplete', 'QuestionsReady', 'InInterview', 'Completed', 'Archived']);
export const WORK_ARRANGEMENTS = Object.freeze(['Hybrid', 'Remote', 'In-Person']);

const allowedTransitions = Object.freeze({
  Draft: ['UploadsComplete'],
  UploadsComplete: ['QuestionsReady'],
  QuestionsReady: ['InInterview'],
  InInterview: ['Completed'],
  Completed: ['Archived'],
  Archived: []
});
const allowedCreateFields = new Set([
  'interviewId', 'jobPostingId', 'jobPostingTitle', 'department', 'location', 'workArrangement',
  'jobDescription', 'candidateName', 'candidateEmail', 'candidateCurrentTitle', 'candidateNotes',
  'interviewDate', 'archiveFolderId', 'resumeNotes', 'processingNotes', 'supplementNotes', 'supplementalLinks',
  'questions', 'files', 'tags'
]);
const fileTypes = new Set(['Job Posting', 'Resume', 'Supplement']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function rejectUnsupportedFields(value, allowedFields, context) {
  const unsupportedField = Object.keys(value).find((fieldName) => !allowedFields.has(fieldName));
  if (unsupportedField) throw new HttpError(400, 'INVALID_REQUEST', `Unsupported ${context} property: ${unsupportedField}.`);
}

function requiredText(value, fieldName, maxLength) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, 'INVALID_REQUEST', `${fieldName} is required.`);
  const normalizedValue = value.trim().replace(/\s+/g, ' ');
  if (normalizedValue.length > maxLength) throw new HttpError(400, 'INVALID_REQUEST', `${fieldName} must be ${maxLength} characters or fewer.`);
  return normalizedValue;
}

function optionalText(value, fieldName, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new HttpError(400, 'INVALID_REQUEST', `${fieldName} must be text.`);
  const normalizedValue = value.trim();
  if (!normalizedValue) return null;
  if (normalizedValue.length > maxLength) throw new HttpError(400, 'INVALID_REQUEST', `${fieldName} must be ${maxLength} characters or fewer.`);
  return normalizedValue;
}

function optionalUuid(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, 'INVALID_REQUEST', `${fieldName} must be a valid UUID.`);
  }
  return value.toLowerCase();
}

function normalizedDate(value, fallbackDate) {
  if (value === undefined || value === null || value === '') return fallbackDate.toISOString().slice(0, 10);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, 'INVALID_REQUEST', 'interviewDate must use the YYYY-MM-DD format.');
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, 'INVALID_REQUEST', 'interviewDate must be a valid calendar date.');
  }
  return value;
}

function normalizedTags(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) throw new HttpError(400, 'INVALID_REQUEST', 'tags must be an array containing no more than 20 items.');
  const seenTags = new Set();
  return value.reduce((tags, tag) => {
    const normalizedTag = requiredText(tag, 'Each tag', 40);
    const tagKey = normalizedTag.toLowerCase();
    if (!seenTags.has(tagKey)) { seenTags.add(tagKey); tags.push(normalizedTag); }
    return tags;
  }, []);
}

function normalizedLinks(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50) throw new HttpError(400, 'INVALID_REQUEST', 'supplementalLinks must contain no more than 50 items.');
  return value.map((link) => {
    if (!isRecord(link)) throw new HttpError(400, 'INVALID_REQUEST', 'Each supplemental link must be an object.');
    rejectUnsupportedFields(link, new Set(['label', 'url']), 'supplemental link');
    const label = requiredText(link.label, 'Supplemental link label', 120);
    const url = requiredText(link.url, 'Supplemental link URL', 2048);
    let parsedUrl;
    try { parsedUrl = new URL(url); } catch { throw new HttpError(400, 'INVALID_REQUEST', 'Supplemental link URLs must be valid.'); }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new HttpError(400, 'INVALID_REQUEST', 'Supplemental link URLs must use http or https.');
    return { label, url: parsedUrl.toString() };
  });
}

function normalizedQuestions(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) throw new HttpError(400, 'INVALID_REQUEST', 'questions must contain no more than 100 items.');
  return value.map((question) => {
    if (!isRecord(question)) throw new HttpError(400, 'INVALID_REQUEST', 'Each question must be an object.');
    rejectUnsupportedFields(question, new Set(['prompt']), 'question');
    return { prompt: requiredText(question.prompt, 'Question prompt', 4000) };
  });
}

function normalizedFiles(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) throw new HttpError(400, 'INVALID_REQUEST', 'files must contain no more than 100 items.');
  return value.map((file) => {
    if (!isRecord(file)) throw new HttpError(400, 'INVALID_REQUEST', 'Each file must be an object.');
    rejectUnsupportedFields(file, new Set(['name', 'fileType', 'sizeBytes', 'storageObjectPath']), 'file');
    const name = requiredText(file.name, 'File name', 255);
    const fileType = requiredText(file.fileType, 'File type', 80);
    if (!fileTypes.has(fileType)) throw new HttpError(400, 'INVALID_REQUEST', 'File type must be Job Posting, Resume, or Supplement.');
    if (!Number.isInteger(file.sizeBytes) || file.sizeBytes < 0 || file.sizeBytes > 50 * 1024 * 1024) {
      throw new HttpError(400, 'INVALID_REQUEST', 'File size must be between 0 and 50 MB.');
    }
    return { name, fileType, sizeBytes: file.sizeBytes, storageObjectPath: requiredText(file.storageObjectPath, 'Storage object path', 1024) };
  });
}

function archiveSegment(value) {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/-+/g, '-').trim();
}

export function createArchivePath(jobPostingTitle, candidateName, interviewDate) {
  return `${archiveSegment(jobPostingTitle)}/${archiveSegment(candidateName)} - ${interviewDate}`;
}

export function normalizeNewInterview(body, now = new Date()) {
  if (!isRecord(body)) throw new HttpError(400, 'INVALID_REQUEST', 'The request body must be a JSON object.');
  rejectUnsupportedFields(body, allowedCreateFields, 'request');
  const jobPostingTitle = requiredText(body.jobPostingTitle, 'jobPostingTitle', 160);
  const candidateName = requiredText(body.candidateName, 'candidateName', 120);
  const interviewDate = normalizedDate(body.interviewDate, now);
  const workArrangement = body.workArrangement === undefined ? 'Hybrid' : requiredText(body.workArrangement, 'workArrangement', 20);
  if (!WORK_ARRANGEMENTS.includes(workArrangement)) throw new HttpError(400, 'INVALID_REQUEST', 'workArrangement must be Hybrid, Remote, or In-Person.');
  const candidateEmail = optionalText(body.candidateEmail, 'candidateEmail', 320);
  if (candidateEmail && !/^\S+@\S+\.\S+$/.test(candidateEmail)) throw new HttpError(400, 'INVALID_REQUEST', 'candidateEmail must be a valid email address.');

  return {
    interviewId: optionalUuid(body.interviewId, 'interviewId'),
    jobPostingId: optionalUuid(body.jobPostingId, 'jobPostingId'),
    jobPostingTitle,
    department: optionalText(body.department, 'department', 120),
    location: optionalText(body.location, 'location', 160),
    workArrangement,
    jobDescription: optionalText(body.jobDescription, 'jobDescription', 20000),
    candidateName,
    candidateEmail,
    candidateCurrentTitle: optionalText(body.candidateCurrentTitle, 'candidateCurrentTitle', 120),
    candidateNotes: optionalText(body.candidateNotes, 'candidateNotes', 20000),
    interviewDate,
    archiveFolderId: optionalUuid(body.archiveFolderId, 'archiveFolderId'),
    resumeNotes: optionalText(body.resumeNotes, 'resumeNotes', 20000),
    processingNotes: optionalText(body.processingNotes, 'processingNotes', 20000),
    supplementNotes: optionalText(body.supplementNotes, 'supplementNotes', 20000),
    supplementalLinks: normalizedLinks(body.supplementalLinks),
    questions: normalizedQuestions(body.questions),
    files: normalizedFiles(body.files),
    tags: normalizedTags(body.tags),
    archivePath: createArchivePath(jobPostingTitle, candidateName, interviewDate)
  };
}

export function validateStatusTransition(currentStatus, nextStatus) {
  if (!INTERVIEW_STATUSES.includes(nextStatus)) throw new HttpError(400, 'INVALID_STATUS', 'status must be a valid interview lifecycle state.');
  if (!INTERVIEW_STATUSES.includes(currentStatus)) throw new HttpError(409, 'INVALID_CURRENT_STATUS', 'The interview has an unsupported lifecycle state.');
  if (currentStatus === nextStatus) return false;
  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    throw new HttpError(409, 'INVALID_STATUS_TRANSITION', `An interview in ${currentStatus} can only move to: ${allowedTransitions[currentStatus].join(', ') || 'no further states'}.`);
  }
  return true;
}
