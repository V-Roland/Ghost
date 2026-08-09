import React, { useEffect, useState } from 'react';
import FolderIcon from '../../../assets/icons/content/folder/FolderIcon.jsx';
import DroppableFolderRow from '../../../components/archive/droppable-folder-row/DroppableFolderRow.jsx';
import FileTable from '../../../components/archive/file-table/FileTable.jsx';
import FolderDialog from '../../../components/archive/folder-dialog/FolderDialog.jsx';
import Breadcrumb from '../../../components/breadcrumb/Breadcrumb.jsx';
import PageHeader from '../../../components/page-header/PageHeader.jsx';
import * as archiveService from '../../../services/archive/archiveService.js';
import {
  downloadArchiveFile,
  exportArchiveZip,
  openArchiveFile
} from '../../../services/archive/archiveFileService.js';

export default function ArchiveFolder({ folderTrail, onBack, onOpenFolder, onSelectInterview }) {
  const folder = folderTrail[folderTrail.length - 1];
  const [content, setContent] = useState({ folders: [], files: [], interviews: [] });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [workingFileId, setWorkingFileId] = useState(null);

  useEffect(() => {
    setLoading(true);
    archiveService.loadArchiveFolder(folder.id)
      .then(setContent)
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [folder.id]);

  const createFolder = async (name) => {
    const createdFolder = await archiveService.createArchiveFolder({
      name,
      jobPostingId: folder.jobPostingId,
      interviewId: folder.interviewId,
      parentFolderId: folder.id
    });
    setContent((current) => ({ ...current, folders: [...current.folders, createdFolder].sort((left, right) => left.name.localeCompare(right.name)) }));
  };

  const runFileAction = async (file, action) => {
    setWorkingFileId(file.id);
    setError('');
    try { await action(file); } catch (fileError) { setError(fileError.message || 'The file action failed.'); }
    finally { setWorkingFileId(null); }
  };

  const moveFileToFolder = async (fileId, destinationFolder) => {
    setWorkingFileId(fileId);
    setError('');
    try {
      await archiveService.moveArchiveFile(fileId, destinationFolder.id);
      setContent((current) => ({ ...current, files: current.files.filter((file) => file.id !== fileId) }));
    } catch (moveError) {
      setError(moveError.message || 'The file could not be moved.');
    } finally {
      setWorkingFileId(null);
    }
  };

  const exportFolder = async () => {
    setExporting(true);
    setError('');
    try { await exportArchiveZip({ folderId: folder.id }); } catch (exportError) { setError(exportError.message || 'The folder ZIP could not be created.'); }
    finally { setExporting(false); }
  };

  return (
    <section>
      <Breadcrumb items={['Archive', ...folderTrail.map((item) => item.name)]} />
      <PageHeader title={folder.name} subtitle="Database-backed archive folder" actions={<><button type="button" onClick={() => setDialogOpen(true)}>+ Folder</button><button type="button" className="primary" onClick={exportFolder} disabled={exporting}>{exporting ? 'Creating ZIP…' : 'Download ZIP'}</button></>} />
      {error && <div className="auth-error" role="alert">{error}</div>}
      {loading && <div className="profile-loading">Loading folder…</div>}
      {content.folders.length > 0 && content.files.length > 0 && <p className="archive-drag-hint">Drag a file row onto a child folder to move it.</p>}
      <div className="table card">
        <div className="table-row file-table-row head"><span>Name</span><span>Type</span><span>Size</span><span>Actions</span></div>
        {content.folders.map((childFolder) => (
          <DroppableFolderRow key={childFolder.id} folder={childFolder} onOpen={onOpenFolder} onFileDrop={moveFileToFolder} />
        ))}
        {content.interviews.map((interview) => (
          <button className="table-row file-table-row folder" key={interview.id} onClick={() => onSelectInterview(interview)}>
            <span className="file-name"><FolderIcon />{interview.candidateName}</span><span>{interview.jobPostingTitle}</span><span>{interview.interviewDate}</span><span>Open</span>
          </button>
        ))}
        <FileTable draggable={content.folders.length > 0} files={content.files} workingFileId={workingFileId} onOpen={(file) => runFileAction(file, openArchiveFile)} onDownload={(file) => runFileAction(file, downloadArchiveFile)} />
        {!loading && !content.files.length && !content.folders.length && !content.interviews.length && <div className="empty-table">This folder is empty.</div>}
      </div>
      <button className="ghost-link back" onClick={onBack}>Back</button>
      <FolderDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreate={createFolder} />
    </section>
  );
}
