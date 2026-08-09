import React, { useEffect, useState } from 'react';
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

export default function CandidateFiles({ job, candidate, setScreen, onOpenFolder }) {
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState(() => candidate.files.filter((file) => !file.folderId));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [workingFileId, setWorkingFileId] = useState(null);

  useEffect(() => {
    archiveService.loadArchiveFolders({ jobPostingId: job.jobPostingId, interviewId: candidate.interviewId })
      .then(setFolders)
      .catch((loadError) => setError(loadError.message));
  }, [candidate.interviewId, job.jobPostingId]);

  useEffect(() => {
    setFiles(candidate.files.filter((file) => !file.folderId));
  }, [candidate.files, candidate.interviewId]);

  const createFolder = async (name) => {
    const folder = await archiveService.createArchiveFolder({
      name,
      jobPostingId: job.jobPostingId,
      interviewId: candidate.interviewId
    });
    setFolders((current) => [...current, folder].sort((left, right) => left.name.localeCompare(right.name)));
  };

  const runFileAction = async (file, action) => {
    setWorkingFileId(file.id);
    setError('');
    try { await action(file); } catch (fileError) { setError(fileError.message || 'The file action failed.'); }
    finally { setWorkingFileId(null); }
  };

  const moveFileToFolder = async (fileId, folder) => {
    setWorkingFileId(fileId);
    setError('');
    try {
      await archiveService.moveArchiveFile(fileId, folder.id);
      setFiles((current) => current.filter((file) => file.id !== fileId));
    } catch (moveError) {
      setError(moveError.message || 'The file could not be moved.');
    } finally {
      setWorkingFileId(null);
    }
  };

  const exportFolder = async () => {
    setExporting(true);
    setError('');
    try { await exportArchiveZip({ interviewId: candidate.interviewId }); } catch (exportError) { setError(exportError.message || 'The interview ZIP could not be created.'); }
    finally { setExporting(false); }
  };

  return (
    <section>
      <Breadcrumb items={['Archive', job.name, `${candidate.name} - ${candidate.date}`]} />
      <PageHeader title={candidate.name} subtitle={`Interview on ${candidate.date}`} actions={<><button type="button" onClick={() => setDialogOpen(true)}>+ Folder</button><button type="button" className="primary" onClick={exportFolder} disabled={exporting}>{exporting ? 'Creating ZIP…' : 'Download ZIP'}</button></>} />
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="tabs"><span className="active">Files</span><span>Summary</span><span>Notes</span><span>Signals</span><span>Report</span></div>
      {folders.length > 0 && files.length > 0 && <p className="archive-drag-hint">Drag a file row onto a folder to organize it.</p>}
      <div className="table card">
        <div className="table-row file-table-row head"><span>Name</span><span>Type</span><span>Size</span><span>Actions</span></div>
        {folders.map((folder) => (
          <DroppableFolderRow key={folder.id} folder={folder} onOpen={(selectedFolder) => onOpenFolder(selectedFolder, 'candidate')} onFileDrop={moveFileToFolder} />
        ))}
        <FileTable draggable={folders.length > 0} files={files} workingFileId={workingFileId} onOpen={(file) => runFileAction(file, openArchiveFile)} onDownload={(file) => runFileAction(file, downloadArchiveFile)} />
        {!files.length && !folders.length && <div className="empty-table">No files or folders have been added to this interview.</div>}
      </div>
      <button className="ghost-link back" onClick={() => setScreen('job')}>Back to candidates</button>
      <FolderDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreate={createFolder} />
    </section>
  );
}
