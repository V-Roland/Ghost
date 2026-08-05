export function interviewRecord(record) {
  return {
    id: record.id,
    userId: record.user_id,
    jobPostingTitle: record.job_posting_title,
    candidateName: record.candidate_name,
    interviewDate: record.interview_date,
    status: record.status,
    archivePath: record.archive_path,
    tags: record.tags,
    signalLevel: record.signal_level,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

export function fileRecord(record) {
  return {
    id: record.id,
    userId: record.user_id,
    interviewId: record.interview_id,
    name: record.name,
    type: record.file_type,
    sizeBytes: record.size_bytes,
    storageObjectPath: record.storage_object_path,
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
