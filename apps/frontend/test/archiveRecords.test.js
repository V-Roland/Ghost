import test from 'node:test';
import assert from 'node:assert/strict';
import { groupInterviews, readableFileSize } from '../src/domain/archive/archiveRecords.js';

test('groups interviews returned by the RLS-backed API', () => {
  const jobs = groupInterviews([
    {
      id: 'first',
      jobPostingTitle: 'Platform Engineer',
      candidateName: 'Sally Chen',
      interviewDate: '2026-08-04',
      signalLevel: 'None',
      updatedAt: '2026-08-04T12:00:00.000Z'
    },
    {
      id: 'second',
      jobPostingTitle: 'Platform Engineer',
      candidateName: 'Jordan Lee',
      interviewDate: '2026-08-05',
      signalLevel: 'Review',
      updatedAt: '2026-08-05T12:00:00.000Z'
    }
  ]);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].interviews, 2);
  assert.equal(jobs[0].updated, '2026-08-05');
  assert.deepEqual(jobs[0].candidates.map((candidate) => candidate.interviewId), ['first', 'second']);
});

test('formats storage metadata without exposing object contents', () => {
  assert.equal(readableFileSize(188 * 1024), '188 KB');
  assert.equal(readableFileSize(null), '—');
});
