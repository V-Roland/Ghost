import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createArchivePath,
  normalizeNewInterview,
  validateStatusTransition
} from '../src/lib/interviewLifecycle.js';

test('normalizes valid interview input and removes duplicate tags', () => {
  const interview = normalizeNewInterview({
    jobPostingTitle: '  Platform / API Engineer  ',
    candidateName: '  Jordan  Lee ',
    interviewDate: '2026-08-04',
    tags: ['Engineering', 'engineering', 'Remote']
  });

  assert.deepEqual(interview, {
    jobPostingTitle: 'Platform / API Engineer',
    candidateName: 'Jordan Lee',
    interviewDate: '2026-08-04',
    tags: ['Engineering', 'Remote'],
    archivePath: 'Platform - API Engineer/Jordan Lee - 2026-08-04'
  });
});

test('rejects incomplete interview input', () => {
  assert.throws(
    () => normalizeNewInterview({ candidateName: 'Jordan Lee' }),
    { code: 'INVALID_REQUEST', message: 'jobPostingTitle is required.' }
  );
});

test('rejects undeclared create fields, including request context', () => {
  assert.throws(
    () => normalizeNewInterview({ jobPostingTitle: 'Engineer', candidateName: 'Jordan Lee', tenantId: 'tenant-other' }),
    { code: 'INVALID_REQUEST', message: 'Unsupported request property: tenantId.' }
  );
});

test('rejects invalid dates and tag collections', () => {
  assert.throws(
    () => normalizeNewInterview({ jobPostingTitle: 'Engineer', candidateName: 'Jordan Lee', interviewDate: '2026-02-30' }),
    { code: 'INVALID_REQUEST', message: 'interviewDate must be a valid calendar date.' }
  );
  assert.throws(
    () => normalizeNewInterview({ jobPostingTitle: 'Engineer', candidateName: 'Jordan Lee', tags: 'engineering' }),
    { code: 'INVALID_REQUEST', message: 'tags must be an array containing no more than 20 items.' }
  );
});

test('builds archive paths with safe logical segments', () => {
  assert.equal(
    createArchivePath('Data: Platform', 'Jordan/Lee', '2026-08-04'),
    'Data- Platform/Jordan-Lee - 2026-08-04'
  );
});

test('only permits sequential interview lifecycle transitions', () => {
  assert.equal(validateStatusTransition('Draft', 'UploadsComplete'), true);
  assert.equal(validateStatusTransition('Draft', 'Draft'), false);
  assert.throws(
    () => validateStatusTransition('Draft', 'Completed'),
    { code: 'INVALID_STATUS_TRANSITION' }
  );
  assert.throws(
    () => validateStatusTransition('Archived', 'Draft'),
    { code: 'INVALID_STATUS_TRANSITION' }
  );
});
