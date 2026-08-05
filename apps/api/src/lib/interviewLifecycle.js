import { HttpError } from './httpError.js';

export const INTERVIEW_STATUSES = Object.freeze([
  'Draft',
  'UploadsComplete',
  'QuestionsReady',
  'InInterview',
  'Completed',
  'Archived'
]);

const allowedTransitions = Object.freeze({
  Draft: ['UploadsComplete'],
  UploadsComplete: ['QuestionsReady'],
  QuestionsReady: ['InInterview'],
  InInterview: ['Completed'],
  Completed: ['Archived'],
  Archived: []
});

const allowedCreateFields = new Set(['jobPostingTitle', 'candidateName', 'interviewDate', 'tags']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value, fieldName, maxLength) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, 'INVALID_REQUEST', `${fieldName} is required.`);
  }

  const normalizedValue = value.trim().replace(/\s+/g, ' ');
  if (normalizedValue.length > maxLength) {
    throw new HttpError(400, 'INVALID_REQUEST', `${fieldName} must be ${maxLength} characters or fewer.`);
  }

  return normalizedValue;
}

function normalizedDate(value, fallbackDate) {
  if (value === undefined || value === null || value === '') {
    return fallbackDate.toISOString().slice(0, 10);
  }

  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, 'INVALID_REQUEST', 'interviewDate must use the YYYY-MM-DD format.');
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, 'INVALID_REQUEST', 'interviewDate must be a valid calendar date.');
  }

  return value;
}

function normalizedTags(value) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.length > 20) {
    throw new HttpError(400, 'INVALID_REQUEST', 'tags must be an array containing no more than 20 items.');
  }

  const seenTags = new Set();
  return value.reduce((tags, tag) => {
    const normalizedTag = requiredText(tag, 'Each tag', 40);
    const tagKey = normalizedTag.toLowerCase();
    if (!seenTags.has(tagKey)) {
      seenTags.add(tagKey);
      tags.push(normalizedTag);
    }
    return tags;
  }, []);
}

function archiveSegment(value) {
  return value
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function createArchivePath(jobPostingTitle, candidateName, interviewDate) {
  return `${archiveSegment(jobPostingTitle)}/${archiveSegment(candidateName)} - ${interviewDate}`;
}

export function normalizeNewInterview(body, now = new Date()) {
  if (!isRecord(body)) {
    throw new HttpError(400, 'INVALID_REQUEST', 'The request body must be a JSON object.');
  }

  const unsupportedField = Object.keys(body).find((fieldName) => !allowedCreateFields.has(fieldName));
  if (unsupportedField) {
    throw new HttpError(400, 'INVALID_REQUEST', `Unsupported request property: ${unsupportedField}.`);
  }

  const jobPostingTitle = requiredText(body.jobPostingTitle, 'jobPostingTitle', 160);
  const candidateName = requiredText(body.candidateName, 'candidateName', 120);
  const interviewDate = normalizedDate(body.interviewDate, now);
  const tags = normalizedTags(body.tags);

  return {
    jobPostingTitle,
    candidateName,
    interviewDate,
    tags,
    archivePath: createArchivePath(jobPostingTitle, candidateName, interviewDate)
  };
}

export function validateStatusTransition(currentStatus, nextStatus) {
  if (!INTERVIEW_STATUSES.includes(nextStatus)) {
    throw new HttpError(400, 'INVALID_STATUS', 'status must be a valid interview lifecycle state.');
  }

  if (!INTERVIEW_STATUSES.includes(currentStatus)) {
    throw new HttpError(409, 'INVALID_CURRENT_STATUS', 'The interview has an unsupported lifecycle state.');
  }

  if (currentStatus === nextStatus) {
    return false;
  }

  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    throw new HttpError(
      409,
      'INVALID_STATUS_TRANSITION',
      `An interview in ${currentStatus} can only move to: ${allowedTransitions[currentStatus].join(', ') || 'no further states'}.`
    );
  }

  return true;
}
