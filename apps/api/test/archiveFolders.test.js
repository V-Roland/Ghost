import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArchiveFileMove, normalizeArchiveFolder } from '../src/lib/archiveFolders.js';
import { buildArchiveManifest } from '../src/lib/archiveManifest.js';

const jobPostingId = '10000000-0000-4000-8000-000000000001';
const interviewId = '30000000-0000-4000-8000-000000000001';
const folderId = '40000000-0000-4000-8000-000000000001';

test('normalizes an owner-agnostic archive folder request', () => {
  assert.deepEqual(normalizeArchiveFolder({
    name: '  Hiring Packet  ',
    jobPostingId,
    interviewId,
    parentFolderId: null
  }), {
    name: 'Hiring Packet',
    jobPostingId,
    interviewId,
    parentFolderId: null
  });
});

test('rejects unsafe names and caller-supplied ownership', () => {
  assert.throws(() => normalizeArchiveFolder({ name: '../Private' }), { code: 'INVALID_REQUEST' });
  assert.throws(() => normalizeArchiveFolder({ name: 'Folder', userId: 'spoofed' }), {
    code: 'INVALID_REQUEST',
    message: 'Unsupported folder property: userId.'
  });
});

test('normalizes file moves without accepting ownership or interview scope', () => {
  assert.deepEqual(normalizeArchiveFileMove({ folderId }), { folderId });
  assert.deepEqual(normalizeArchiveFileMove({ folderId: null }), { folderId: null });
  assert.throws(() => normalizeArchiveFileMove({ folderId, interviewId }), {
    code: 'INVALID_REQUEST',
    message: 'Unsupported file move property: interviewId.'
  });
});

test('builds literal job, interview, and custom folder export paths', () => {
  const manifest = buildArchiveManifest(
    [{ id: interviewId, jobPostingId, jobPostingTitle: 'Platform Engineer', candidateName: 'Sally Chen', interviewDate: '2026-08-06' }],
    [{ id: folderId, jobPostingId, interviewId, parentFolderId: null, name: 'Evidence' }],
    [
      { id: 'file-root', interviewId, folderId: null, name: 'Resume.pdf', storageObjectPath: 'user/interview/resume.pdf' },
      { id: 'file-folder', interviewId, folderId, name: 'Notes.txt', storageObjectPath: 'user/interview/notes.txt' }
    ]
  );
  assert.ok(manifest.directories.includes('Platform Engineer/Sally Chen - 2026-08-06'));
  assert.ok(manifest.directories.includes('Platform Engineer/Sally Chen - 2026-08-06/Evidence'));
  assert.deepEqual(manifest.files.map((file) => file.path), [
    'Platform Engineer/Sally Chen - 2026-08-06/Resume.pdf',
    'Platform Engineer/Sally Chen - 2026-08-06/Evidence/Notes.txt'
  ]);
});

test('limits a custom-folder export to that folder subtree', () => {
  const manifest = buildArchiveManifest(
    [{ id: interviewId, jobPostingId, jobPostingTitle: 'Platform Engineer', candidateName: 'Sally Chen', interviewDate: '2026-08-06' }],
    [{ id: folderId, jobPostingId, interviewId, parentFolderId: null, name: 'Evidence' }],
    [
      { id: 'file-root', interviewId, folderId: null, name: 'Resume.pdf', storageObjectPath: 'user/interview/resume.pdf' },
      { id: 'file-folder', interviewId, folderId, name: 'Notes.txt', storageObjectPath: 'user/interview/notes.txt' }
    ],
    { folderId }
  );
  assert.deepEqual(manifest.directories, ['Evidence']);
  assert.deepEqual(manifest.files.map((file) => file.path), ['Evidence/Notes.txt']);
});

test('exports interviews assigned to a custom directory with their files', () => {
  const placementFolderId = '40000000-0000-4000-8000-000000000002';
  const evidenceFolderId = '40000000-0000-4000-8000-000000000003';
  const manifest = buildArchiveManifest(
    [{
      id: interviewId,
      jobPostingId,
      jobPostingTitle: 'Platform Engineer',
      candidateName: 'Sally Chen',
      interviewDate: '2026-08-06',
      archiveFolderId: placementFolderId
    }],
    [
      { id: placementFolderId, jobPostingId: null, interviewId: null, parentFolderId: null, name: 'Hiring 2026' },
      { id: evidenceFolderId, jobPostingId, interviewId, parentFolderId: null, name: 'Evidence' }
    ],
    [
      { id: 'file-root', interviewId, folderId: null, name: 'Resume.pdf', storageObjectPath: 'user/interview/resume.pdf' },
      { id: 'file-folder', interviewId, folderId: evidenceFolderId, name: 'Notes.txt', storageObjectPath: 'user/interview/notes.txt' }
    ],
    { folderId: placementFolderId }
  );

  assert.ok(manifest.directories.includes('Hiring 2026/Platform Engineer/Sally Chen - 2026-08-06'));
  assert.ok(manifest.directories.includes('Hiring 2026/Platform Engineer/Sally Chen - 2026-08-06/Evidence'));
  assert.deepEqual(manifest.files.map((file) => file.path), [
    'Hiring 2026/Platform Engineer/Sally Chen - 2026-08-06/Resume.pdf',
    'Hiring 2026/Platform Engineer/Sally Chen - 2026-08-06/Evidence/Notes.txt'
  ]);
});
