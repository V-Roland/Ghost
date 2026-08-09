import { getSupabaseClient } from '../supabase/client.js';

const fileGroups = Object.freeze([
  { key: 'jobPosting', fileType: 'Job Posting' },
  { key: 'resumes', fileType: 'Resume' },
  { key: 'supplements', fileType: 'Supplement' }
]);

export function createUploadUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function safeObjectName(fileName) {
  const normalizedName = fileName.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  return normalizedName.replace(/^[-.]+|[-.]+$/g, '').slice(0, 180) || 'upload';
}

export async function removeStagedInterviewFiles(stagedFiles) {
  if (!stagedFiles.length) return;
  const paths = stagedFiles.map((file) => file.storageObjectPath);
  const { error } = await getSupabaseClient().storage.from('interview-files').remove(paths);
  if (error) throw new Error(`Uploaded file cleanup failed: ${error.message}`);
}

export async function stageInterviewFiles(interviewId, filesByCategory) {
  const supabase = getSupabaseClient();
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) throw new Error('Your session has expired. Sign in again.');
  const stagedFiles = [];

  try {
    for (const group of fileGroups) {
      for (const file of filesByCategory[group.key] || []) {
        const storageObjectPath = `${data.user.id}/${interviewId}/${createUploadUuid()}-${safeObjectName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from('interview-files').upload(storageObjectPath, file, {
          cacheControl: '3600',
          contentType: file.type || undefined,
          upsert: false
        });
        if (uploadError) throw new Error(`${file.name} could not be uploaded: ${uploadError.message}`);
        stagedFiles.push({
          name: file.name.slice(0, 255),
          fileType: group.fileType,
          sizeBytes: file.size,
          storageObjectPath
        });
      }
    }
    return stagedFiles;
  } catch (error) {
    await removeStagedInterviewFiles(stagedFiles).catch(() => undefined);
    throw error;
  }
}
