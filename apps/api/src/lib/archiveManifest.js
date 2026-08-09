import { HttpError } from './httpError.js';

function safeSegment(value) {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || 'Untitled';
}

function interviewDirectory(interview, folderMap, stopParentId = null) {
  const candidateDirectory = `${safeSegment(interview.candidateName)} - ${interview.interviewDate}`;
  const placementFolder = interview.archiveFolderId ? folderMap.get(interview.archiveFolderId) : null;
  if (!placementFolder) return `${safeSegment(interview.jobPostingTitle)}/${candidateDirectory}`;
  const placementSegments = folderSegments(placementFolder, folderMap, stopParentId);
  return placementFolder.jobPostingId
    ? [safeSegment(interview.jobPostingTitle), ...placementSegments, candidateDirectory].join('/')
    : [...placementSegments, safeSegment(interview.jobPostingTitle), candidateDirectory].join('/');
}

function descendantFolderIds(folders, rootFolderId) {
  const includedIds = new Set([rootFolderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (folder.parentFolderId && includedIds.has(folder.parentFolderId) && !includedIds.has(folder.id)) {
        includedIds.add(folder.id);
        changed = true;
      }
    }
  }
  return includedIds;
}

function folderSegments(folder, folderMap, stopParentId = null) {
  const segments = [];
  const visited = new Set();
  let current = folder;
  while (current && current.id !== stopParentId && !visited.has(current.id)) {
    visited.add(current.id);
    segments.unshift(safeSegment(current.name));
    current = current.parentFolderId ? folderMap.get(current.parentFolderId) : null;
  }
  return segments;
}

function uniquePath(path, usedPaths) {
  if (!usedPaths.has(path.toLowerCase())) {
    usedPaths.add(path.toLowerCase());
    return path;
  }
  const separatorIndex = path.lastIndexOf('/');
  const directory = separatorIndex >= 0 ? path.slice(0, separatorIndex + 1) : '';
  const fileName = separatorIndex >= 0 ? path.slice(separatorIndex + 1) : path;
  const extensionIndex = fileName.lastIndexOf('.');
  const stem = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
  const extension = extensionIndex > 0 ? fileName.slice(extensionIndex) : '';
  let copyNumber = 2;
  let candidate = `${directory}${stem} (${copyNumber})${extension}`;
  while (usedPaths.has(candidate.toLowerCase())) {
    copyNumber += 1;
    candidate = `${directory}${stem} (${copyNumber})${extension}`;
  }
  usedPaths.add(candidate.toLowerCase());
  return candidate;
}

export function buildArchiveManifest(interviews, folders, files, scope = {}) {
  const interviewMap = new Map(interviews.map((interview) => [interview.id, interview]));
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  const rootFolder = scope.folderId ? folderMap.get(scope.folderId) : null;
  if (scope.folderId && !rootFolder) throw new HttpError(404, 'RESOURCE_NOT_FOUND', 'The requested archive folder was not found.');

  const includedFolderIds = scope.folderId ? descendantFolderIds(folders, scope.folderId) : null;
  const placedInterviewIds = new Set(scope.folderId
    ? interviews
      .filter((interview) => interview.archiveFolderId && includedFolderIds.has(interview.archiveFolderId))
      .map((interview) => interview.id)
    : []);
  const includedInterviews = interviews.filter((interview) => {
    if (scope.folderId) return placedInterviewIds.has(interview.id) || (rootFolder.interviewId && interview.id === rootFolder.interviewId);
    if (scope.interviewId) return interview.id === scope.interviewId;
    if (scope.jobPostingId) return interview.jobPostingId === scope.jobPostingId;
    return true;
  });
  const includedInterviewIds = new Set(includedInterviews.map((interview) => interview.id));
  const includedFolders = folders.filter((folder) => {
    if (includedFolderIds) return includedFolderIds.has(folder.id) || (folder.interviewId && placedInterviewIds.has(folder.interviewId));
    if (scope.interviewId) return folder.interviewId === scope.interviewId;
    if (scope.jobPostingId) return folder.jobPostingId === scope.jobPostingId;
    return true;
  });
  const includedExportFolderIds = new Set(includedFolders.map((folder) => folder.id));

  const directories = new Set();
  if (!scope.folderId) {
    for (const interview of includedInterviews) directories.add(interviewDirectory(interview, folderMap));
  } else {
    for (const interview of includedInterviews.filter((item) => placedInterviewIds.has(item.id))) {
      directories.add(interviewDirectory(interview, folderMap, rootFolder.parentFolderId));
    }
  }
  const folderPaths = new Map();
  for (const folder of includedFolders) {
    const interview = folder.interviewId ? interviewMap.get(folder.interviewId) : null;
    const jobTitle = interview?.jobPostingTitle
      || interviews.find((item) => item.jobPostingId === folder.jobPostingId)?.jobPostingTitle
      || 'Position';
    const belongsToPlacedInterview = scope.folderId && interview && placedInterviewIds.has(interview.id);
    const baseSegments = scope.folderId
      ? belongsToPlacedInterview
        ? interviewDirectory(interview, folderMap, rootFolder.parentFolderId).split('/')
        : []
      : interview
        ? interviewDirectory(interview, folderMap).split('/')
        : folder.jobPostingId
          ? [safeSegment(jobTitle)]
          : [];
    const stopParentId = scope.folderId && !belongsToPlacedInterview ? rootFolder.parentFolderId : null;
    const path = [...baseSegments, ...folderSegments(folder, folderMap, stopParentId)].join('/');
    folderPaths.set(folder.id, path);
    directories.add(path);
  }

  const usedPaths = new Set();
  const manifestFiles = files
    .filter((file) => {
      if (includedFolderIds) {
        if (file.folderId && includedExportFolderIds.has(file.folderId)) return true;
        return placedInterviewIds.has(file.interviewId) && !file.folderId;
      }
      return includedInterviewIds.has(file.interviewId);
    })
    .map((file) => {
      const interview = interviewMap.get(file.interviewId);
      const directory = file.folderId && folderPaths.has(file.folderId)
        ? folderPaths.get(file.folderId)
        : interviewDirectory(interview, folderMap, scope.folderId ? rootFolder.parentFolderId : null);
      const path = uniquePath(`${directory}/${safeSegment(file.name)}`, usedPaths);
      directories.add(directory);
      return { ...file, path };
    });

  const exportName = scope.folderId
    ? safeSegment(rootFolder.name)
    : scope.interviewId
      ? safeSegment(interviewMap.get(scope.interviewId)?.candidateName || 'Interview')
      : scope.jobPostingId
        ? safeSegment(includedInterviews[0]?.jobPostingTitle || 'Position')
        : 'Ghost Archive';

  return {
    name: exportName,
    directories: [...directories].filter(Boolean).sort(),
    files: manifestFiles
  };
}
