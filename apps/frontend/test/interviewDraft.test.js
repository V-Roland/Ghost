import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInterviewDraft,
  interviewSubmission,
  positionTitleFromFileName,
  validateWorkflowStep
} from '../src/domain/workflow/interviewDraft.js';
import { locationOptions } from '../src/domain/workflow/locationSuggestions.js';

test('creates an editable manual workflow draft', () => {
  const draft = createInterviewDraft('2026-08-06');
  assert.equal(draft.jobPosting.workArrangement, 'Hybrid');
  assert.equal(draft.candidate.interviewDate, '2026-08-06');
  assert.equal(draft.archiveFolderId, null);
  assert.equal(draft.supplementalLinks.length, 1);
  assert.equal(draft.questions.length, 1);
});

test('validates required fields and supplemental URLs at review', () => {
  const draft = createInterviewDraft('2026-08-06');
  assert.equal(validateWorkflowStep(draft, 6)[0], 'Enter or select a position title.');
  draft.jobPosting.title = 'Platform Engineer';
  draft.candidate.name = 'Sally Chen';
  draft.supplementalLinks[0] = { id: 'link', label: 'Portfolio', url: 'file:///private' };
  assert.deepEqual(validateWorkflowStep(draft, 6), ['Supplemental links must use an http or https URL.']);
});

test('builds an API payload without browser-only editable IDs', () => {
  const draft = createInterviewDraft('2026-08-06');
  draft.jobPosting.title = 'Platform Engineer';
  draft.candidate.name = 'Sally Chen';
  draft.supplementalLinks = [{ id: 'local-link', label: 'Portfolio', url: 'https://example.com' }];
  draft.questions = [{ id: 'local-question', prompt: 'How would you debug a delayed service?' }];
  draft.archiveFolderId = '40000000-0000-4000-8000-000000000001';
  const submission = interviewSubmission(draft, '2ed8f422-395f-45a9-8ad8-cf43f2411240', []);
  assert.deepEqual(submission.supplementalLinks, [{ label: 'Portfolio', url: 'https://example.com' }]);
  assert.deepEqual(submission.questions, [{ prompt: 'How would you debug a delayed service?' }]);
  assert.equal('id' in submission.questions[0], false);
  assert.equal(submission.archiveFolderId, '40000000-0000-4000-8000-000000000001');
});

test('derives an editable position title from an uploaded posting filename', () => {
  assert.equal(positionTitleFromFileName('Senior-Platform-Engineer-Job-Posting.pdf'), 'Senior Platform Engineer');
  assert.equal(positionTitleFromFileName('job-posting.pdf'), 'job posting');
});

test('prioritizes saved locations before local autofill suggestions', () => {
  const options = locationOptions([{ location: 'Arlington, VA' }, { location: 'New York, NY' }]);
  assert.equal(options[0], 'Arlington, VA');
  assert.equal(options.filter((location) => location === 'New York, NY').length, 1);
});
