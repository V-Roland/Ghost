import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createArchivePath,
  normalizeNewInterview,
  validateStatusTransition
} from '../src/lib/interviewLifecycle.js';

test('normalizes valid interview input and removes duplicate tags', () => {
  const interview = normalizeNewInterview({
    interviewId: '2ed8f422-395f-45a9-8ad8-cf43f2411240',
    jobPostingTitle: '  Platform / API Engineer  ',
    department: ' Engineering ',
    location: ' New York ',
    workArrangement: 'Hybrid',
    jobDescription: ' Build reliable APIs. ',
    candidateName: '  Jordan  Lee ',
    candidateEmail: 'jordan@example.com',
    candidateCurrentTitle: 'Software Engineer',
    candidateNotes: 'Approved recruiter context.',
    interviewDate: '2026-08-04',
    archiveFolderId: '40000000-0000-4000-8000-000000000001',
    resumeNotes: 'Distributed systems experience.',
    processingNotes: 'Focus on system design.',
    supplementNotes: 'Review portfolio before interview.',
    supplementalLinks: [{ label: 'Portfolio', url: 'https://portfolio.example' }],
    questions: [{ prompt: 'Describe a resilient API design.' }],
    files: [{
      name: 'job-posting.pdf',
      fileType: 'Job Posting',
      sizeBytes: 2048,
      storageObjectPath: 'user/workspace/job-posting.pdf'
    }],
    tags: ['Engineering', 'engineering', 'Remote']
  });

  assert.equal(interview.jobPostingTitle, 'Platform / API Engineer');
  assert.equal(interview.department, 'Engineering');
  assert.equal(interview.candidateName, 'Jordan Lee');
  assert.equal(interview.workArrangement, 'Hybrid');
  assert.equal(interview.archiveFolderId, '40000000-0000-4000-8000-000000000001');
  assert.equal(interview.supplementalLinks[0].url, 'https://portfolio.example/');
  assert.deepEqual(interview.questions, [{ prompt: 'Describe a resilient API design.' }]);
  assert.deepEqual(interview.tags, ['Engineering', 'Remote']);
  assert.equal(interview.archivePath, 'Platform - API Engineer/Jordan Lee - 2026-08-04');
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

test('rejects unsupported work arrangements and unsafe supplemental URLs', () => {
  assert.throws(
    () => normalizeNewInterview({ jobPostingTitle: 'Engineer', candidateName: 'Jordan Lee', workArrangement: 'Flexible' }),
    { code: 'INVALID_REQUEST', message: 'workArrangement must be Hybrid, Remote, or In-Person.' }
  );
  assert.throws(
    () => normalizeNewInterview({
      jobPostingTitle: 'Engineer',
      candidateName: 'Jordan Lee',
      supplementalLinks: [{ label: 'Local file', url: 'file:///private/document' }]
    }),
    { code: 'INVALID_REQUEST', message: 'Supplemental link URLs must use http or https.' }
  );
});

test('rejects invalid upload metadata and nested ownership fields', () => {
  assert.throws(
    () => normalizeNewInterview({
      jobPostingTitle: 'Engineer',
      candidateName: 'Jordan Lee',
      files: [{ name: 'resume.pdf', fileType: 'Resume', sizeBytes: 10, storageObjectPath: 'user/interview/resume.pdf', userId: 'spoofed' }]
    }),
    { code: 'INVALID_REQUEST', message: 'Unsupported file property: userId.' }
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
