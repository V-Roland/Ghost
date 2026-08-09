function folderPath(folder, folderMap) {
  const path = [];
  const visited = new Set();
  let current = folder;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current.name);
    current = current.parentFolderId ? folderMap.get(current.parentFolderId) : null;
  }
  return path;
}

export function archiveDirectoryOptions(folders) {
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  return folders
    .map((folder) => ({
      id: folder.id,
      label: `${folder.jobPostingId ? 'Position' : 'Archive'} / ${folderPath(folder, folderMap).join(' / ')}`
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}
