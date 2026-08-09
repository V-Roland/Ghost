import { getSupabaseClient } from '../supabase/client.js';
import { loadExportManifest } from './archiveService.js';
import { createZipArchive } from './zipArchive.js';

function assertStoragePath(file) {
  if (!file?.storageObjectPath || typeof file.storageObjectPath !== 'string') {
    throw new Error('This file does not have a valid private Storage path.');
  }
}

async function downloadBlob(file) {
  assertStoragePath(file);
  const { data, error } = await getSupabaseClient().storage.from('interview-files').download(file.storageObjectPath);
  if (error || !data) throw new Error(error?.message || `${file.name} could not be downloaded.`);
  return data;
}

function triggerBrowserDownload(fileName, blob) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function openArchiveFile(file) {
  assertStoragePath(file);
  const pendingWindow = window.open('', '_blank');
  try {
    const { data, error } = await getSupabaseClient().storage
      .from('interview-files')
      .createSignedUrl(file.storageObjectPath, 60);
    if (error || !data?.signedUrl) throw new Error(error?.message || `${file.name} could not be opened.`);
    if (pendingWindow) {
      pendingWindow.opener = null;
      pendingWindow.location.replace(data.signedUrl);
    } else {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    }
  } catch (error) {
    pendingWindow?.close();
    throw error;
  }
}

export async function downloadArchiveFile(file) {
  triggerBrowserDownload(file.name, await downloadBlob(file));
}

export async function exportArchiveZip(scope = {}) {
  const manifest = await loadExportManifest(scope);
  const files = [];
  for (const file of manifest.files) {
    const fileBlob = await downloadBlob(file);
    files.push({ path: file.path, data: new Uint8Array(await fileBlob.arrayBuffer()) });
  }
  const archive = createZipArchive({ directories: manifest.directories, files });
  triggerBrowserDownload(`${manifest.name}.zip`, archive);
  return { cancelled: false, fileCount: manifest.files.length, archiveName: `${manifest.name}.zip` };
}
