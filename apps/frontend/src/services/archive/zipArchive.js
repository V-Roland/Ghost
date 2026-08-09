const ZIP_VERSION = 20;
const UTF8_FLAG = 0x0800;
const STORED_METHOD = 0;
const DOS_DATE_1980_01_01 = 0x0021;
const MAX_UINT16 = 0xffff;
const MAX_UINT32 = 0xffffffff;

const crcTable = new Uint32Array(256);
for (let tableIndex = 0; tableIndex < crcTable.length; tableIndex += 1) {
  let checksum = tableIndex;
  for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) {
    checksum = checksum & 1 ? 0xedb88320 ^ (checksum >>> 1) : checksum >>> 1;
  }
  crcTable[tableIndex] = checksum >>> 0;
}

function crc32(bytes) {
  let checksum = 0xffffffff;
  for (const byte of bytes) checksum = crcTable[(checksum ^ byte) & 0xff] ^ (checksum >>> 8);
  return (checksum ^ 0xffffffff) >>> 0;
}

function zipPath(path, directory = false) {
  if (typeof path !== 'string' || !path.trim()) throw new Error('ZIP entries require a path.');
  const slashPath = path.replaceAll('\\', '/').replace(/\/+$/, '');
  if (slashPath.startsWith('/') || /^[a-z]:/i.test(slashPath) || slashPath.includes('\0')) {
    throw new Error('ZIP entry paths must be relative.');
  }
  const segments = slashPath.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('ZIP entry paths cannot traverse directories.');
  }
  const normalizedPath = segments.join('/');
  return directory ? `${normalizedPath}/` : normalizedPath;
}

function bytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new Error('ZIP file data must be binary.');
}

function localHeader(entry) {
  const header = new Uint8Array(30);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, ZIP_VERSION, true);
  view.setUint16(6, UTF8_FLAG, true);
  view.setUint16(8, STORED_METHOD, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, DOS_DATE_1980_01_01, true);
  view.setUint32(14, entry.checksum, true);
  view.setUint32(18, entry.data.byteLength, true);
  view.setUint32(22, entry.data.byteLength, true);
  view.setUint16(26, entry.nameBytes.byteLength, true);
  view.setUint16(28, 0, true);
  return header;
}

function centralHeader(entry) {
  const header = new Uint8Array(46);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, ZIP_VERSION, true);
  view.setUint16(6, ZIP_VERSION, true);
  view.setUint16(8, UTF8_FLAG, true);
  view.setUint16(10, STORED_METHOD, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, DOS_DATE_1980_01_01, true);
  view.setUint32(16, entry.checksum, true);
  view.setUint32(20, entry.data.byteLength, true);
  view.setUint32(24, entry.data.byteLength, true);
  view.setUint16(28, entry.nameBytes.byteLength, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, entry.directory ? 0x10 : 0, true);
  view.setUint32(42, entry.localOffset, true);
  return header;
}

function endOfCentralDirectory(entryCount, centralSize, centralOffset) {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);
  return record;
}

function parentDirectories(path) {
  const segments = path.split('/');
  segments.pop();
  return segments.map((_segment, index) => segments.slice(0, index + 1).join('/'));
}

export function createZipArchive({ directories = [], files = [] }) {
  const encoder = new TextEncoder();
  const directoryPaths = new Set(directories.map((path) => zipPath(path)));
  for (const file of files) {
    const normalizedFilePath = zipPath(file.path);
    for (const directory of parentDirectories(normalizedFilePath)) directoryPaths.add(directory);
  }

  const inputs = [
    ...[...directoryPaths].sort().map((path) => ({ path: zipPath(path, true), data: new Uint8Array(), directory: true })),
    ...files.map((file) => ({ path: zipPath(file.path), data: bytes(file.data), directory: false }))
  ];
  if (inputs.length > MAX_UINT16) throw new Error('This export contains too many ZIP entries.');

  const entries = [];
  const localParts = [];
  let localOffset = 0;
  for (const input of inputs) {
    const nameBytes = encoder.encode(input.path);
    if (nameBytes.byteLength > MAX_UINT16) throw new Error('A ZIP entry path is too long.');
    if (input.data.byteLength > MAX_UINT32) throw new Error('A ZIP entry exceeds the 4 GB format limit.');
    const entry = {
      ...input,
      checksum: crc32(input.data),
      localOffset,
      nameBytes
    };
    const header = localHeader(entry);
    localParts.push(header, nameBytes, input.data);
    localOffset += header.byteLength + nameBytes.byteLength + input.data.byteLength;
    if (localOffset > MAX_UINT32) throw new Error('This export exceeds the 4 GB ZIP format limit.');
    entries.push(entry);
  }

  const centralParts = [];
  let centralSize = 0;
  for (const entry of entries) {
    const header = centralHeader(entry);
    centralParts.push(header, entry.nameBytes);
    centralSize += header.byteLength + entry.nameBytes.byteLength;
  }
  if (centralSize > MAX_UINT32 || localOffset + centralSize > MAX_UINT32) {
    throw new Error('This export exceeds the 4 GB ZIP format limit.');
  }

  return new Blob(
    [...localParts, ...centralParts, endOfCentralDirectory(entries.length, centralSize, localOffset)],
    { type: 'application/zip' }
  );
}
