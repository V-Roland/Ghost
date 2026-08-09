import assert from 'node:assert/strict';
import test from 'node:test';
import { createZipArchive } from '../src/services/archive/zipArchive.js';

function localEntries(archiveBytes) {
  const entries = [];
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset + 4 <= archiveBytes.byteLength) {
    const view = new DataView(archiveBytes.buffer, archiveBytes.byteOffset + offset);
    if (view.getUint32(0, true) !== 0x04034b50) break;
    const compressedSize = view.getUint32(18, true);
    const nameLength = view.getUint16(26, true);
    const extraLength = view.getUint16(28, true);
    const nameOffset = offset + 30;
    const dataOffset = nameOffset + nameLength + extraLength;
    entries.push({
      checksum: view.getUint32(14, true),
      flags: view.getUint16(6, true),
      name: decoder.decode(archiveBytes.slice(nameOffset, nameOffset + nameLength)),
      data: archiveBytes.slice(dataOffset, dataOffset + compressedSize)
    });
    offset = dataOffset + compressedSize;
  }
  return entries;
}

test('creates a standards-compatible stored ZIP with directories and files', async () => {
  const encoder = new TextEncoder();
  const archive = createZipArchive({
    directories: ['Hiring 2026'],
    files: [{ path: 'Hiring 2026/Resume.txt', data: encoder.encode('hello') }]
  });
  const archiveBytes = new Uint8Array(await archive.arrayBuffer());
  const entries = localEntries(archiveBytes);
  const endRecord = new DataView(archiveBytes.buffer, archiveBytes.byteOffset + archiveBytes.byteLength - 22);

  assert.equal(archive.type, 'application/zip');
  assert.deepEqual(entries.map((entry) => entry.name), ['Hiring 2026/', 'Hiring 2026/Resume.txt']);
  assert.equal(entries[1].flags, 0x0800);
  assert.equal(entries[1].checksum, 0x3610a686);
  assert.equal(new TextDecoder().decode(entries[1].data), 'hello');
  assert.equal(endRecord.getUint32(0, true), 0x06054b50);
  assert.equal(endRecord.getUint16(10, true), 2);
});

test('rejects unsafe ZIP paths', () => {
  assert.throws(
    () => createZipArchive({ files: [{ path: '../private.txt', data: new Uint8Array() }] }),
    /cannot traverse/
  );
  assert.throws(
    () => createZipArchive({ files: [{ path: 'C:\\private.txt', data: new Uint8Array() }] }),
    /must be relative/
  );
});
