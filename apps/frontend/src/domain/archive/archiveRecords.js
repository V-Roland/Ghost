export const ARCHIVE_FILE_DRAG_TYPE = 'application/x-ghost-archive-file';

export function groupInterviews(interviews) {
  const jobs = new Map();
  for (const interview of interviews) {
    const jobKey = interview.jobPostingId || interview.jobPostingTitle.toLocaleLowerCase();
    const candidate = {
      id: interview.id,
      interviewId: interview.id,
      name: interview.candidateName,
      date: interview.interviewDate,
      archiveFolderId: interview.archiveFolderId,
      interviews: 1,
      signal: interview.signalLevel === 'None' ? 'No flags' : interview.signalLevel,
      files: []
    };
    const job = jobs.get(jobKey);
    if (job) {
      job.candidates.push(candidate);
      job.interviews += 1;
      if (interview.updatedAt > job.updated) job.updated = interview.updatedAt;
    } else {
      jobs.set(jobKey, {
        id: interview.jobPostingId || interview.id,
        jobPostingId: interview.jobPostingId || null,
        name: interview.jobPostingTitle,
        department: interview.jobPosting?.department || '',
        location: interview.jobPosting?.location || '',
        workArrangement: interview.jobPosting?.workArrangement || 'Hybrid',
        description: interview.jobPosting?.description || '',
        sourceType: interview.jobPosting?.sourceType || 'manual',
        sourceFileName: interview.jobPosting?.sourceFileName || '',
        interviews: 1,
        updated: interview.updatedAt,
        candidates: [candidate]
      });
    }
  }
  return [...jobs.values()].map((job) => ({ ...job, updated: job.updated.slice(0, 10) }));
}

export function readableFileSize(sizeBytes) {
  if (!Number.isFinite(sizeBytes)) return '—';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1048576) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / 1048576).toFixed(1)} MB`;
}
