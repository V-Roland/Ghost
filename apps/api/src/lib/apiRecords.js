export function interviewRecord(record) {
  const jobPosting = Array.isArray(record.job_posting) ? record.job_posting[0] : record.job_posting;
  return {
    id: record.id,
    userId: record.user_id,
    jobPostingId: record.job_posting_id,
    jobPostingTitle: record.job_posting_title,
    candidateName: record.candidate_name,
    interviewDate: record.interview_date,
    archiveFolderId: record.archive_folder_id,
    status: record.status,
    archivePath: record.archive_path,
    tags: record.tags,
    signalLevel: record.signal_level,
    jobPosting: jobPosting ? {
      id: jobPosting.id,
      title: jobPosting.title,
      department: jobPosting.department,
      location: jobPosting.location,
      workArrangement: jobPosting.work_arrangement,
      description: jobPosting.description,
      sourceType: jobPosting.source_type,
      sourceFileName: jobPosting.source_file_name
    } : null,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

export function fileRecord(record) {
  return {
    id: record.id,
    userId: record.user_id,
    interviewId: record.interview_id,
    jobPostingId: record.job_posting_id,
    folderId: record.folder_id,
    name: record.name,
    type: record.file_type,
    sizeBytes: record.size_bytes,
    storageObjectPath: record.storage_object_path,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

export function archiveFolderRecord(record) {
  return {
    id: record.id,
    userId: record.user_id,
    jobPostingId: record.job_posting_id,
    interviewId: record.interview_id,
    parentFolderId: record.parent_folder_id,
    name: record.name,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

export function profileRecord(profile, email) {
  return {
    id: profile.id,
    userId: profile.id,
    email,
    displayName: profile.display_name,
    role: profile.role,
    themePreference: profile.theme_preference,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at
  };
}
