import assert from 'node:assert/strict';
import test from 'node:test';
import { archiveDirectoryOptions } from '../src/domain/archive/archiveDirectories.js';

test('builds stable archive and position directory paths', () => {
  const options = archiveDirectoryOptions([
    { id: 'root', jobPostingId: null, parentFolderId: null, name: 'Hiring 2026' },
    { id: 'nested', jobPostingId: null, parentFolderId: 'root', name: 'Engineering' },
    { id: 'position', jobPostingId: 'job', parentFolderId: null, name: 'Finalists' }
  ]);

  assert.deepEqual(options, [
    { id: 'root', label: 'Archive / Hiring 2026' },
    { id: 'nested', label: 'Archive / Hiring 2026 / Engineering' },
    { id: 'position', label: 'Position / Finalists' }
  ]);
});
