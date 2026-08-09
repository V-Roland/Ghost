import React, { useEffect, useMemo, useState } from 'react';
import FolderIcon from '../../../assets/icons/content/folder/FolderIcon.jsx';
import FolderDialog from '../../../components/archive/folder-dialog/FolderDialog.jsx';
import Breadcrumb from '../../../components/breadcrumb/Breadcrumb.jsx';
import PageHeader from '../../../components/page-header/PageHeader.jsx';
import Toolbar from '../../../components/toolbar/Toolbar.jsx';
import * as archiveService from '../../../services/archive/archiveService.js';
import { exportArchiveZip } from '../../../services/archive/archiveFileService.js';

export default function ArchiveJob({ job, onSelectCandidate, onOpenFolder }) {
  const [folders, setFolders] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return { candidates: job.candidates, folders };
    return {
      candidates: job.candidates.filter((candidate) => candidate.name.toLocaleLowerCase().includes(query)),
      folders: folders.filter((folder) => folder.name.toLocaleLowerCase().includes(query))
    };
  }, [folders, job.candidates, search]);

  useEffect(() => {
    archiveService.loadArchiveFolders({ jobPostingId: job.jobPostingId }).then(setFolders).catch((loadError) => setError(loadError.message));
  }, [job.jobPostingId]);

  const createFolder = async (name) => {
    const folder = await archiveService.createArchiveFolder({ name, jobPostingId: job.jobPostingId });
    setFolders((current) => [...current, folder].sort((left, right) => left.name.localeCompare(right.name)));
  };

  const exportFolder = async () => {
    setExporting(true);
    setError('');
    try { await exportArchiveZip({ jobPostingId: job.jobPostingId }); } catch (exportError) { setError(exportError.message || 'The position ZIP could not be created.'); }
    finally { setExporting(false); }
  };

  return (
    <section>
      <Breadcrumb items={['Archive', job.name]} />
      <PageHeader title={job.name} subtitle="Candidate interview folders" actions={<><button type="button" onClick={() => setDialogOpen(true)}>+ Folder</button><button type="button" className="primary" onClick={exportFolder} disabled={exporting}>{exporting ? 'Creating ZIP…' : 'Download ZIP'}</button></>} />
      {error && <div className="auth-error" role="alert">{error}</div>}
      <Toolbar placeholder="Search candidates and folders..." value={search} onChange={setSearch} />
      <div className="table card">
        <div className="table-row head"><span>Candidate</span><span>Date</span><span>Signal</span></div>
        {visibleEntries.folders.map((folder) => (
          <button className="table-row folder" key={folder.id} onClick={() => onOpenFolder(folder, 'job')}>
            <span className="file-name"><FolderIcon />{folder.name}</span><span>Folder</span><span>—</span>
          </button>
        ))}
        {visibleEntries.candidates.map((candidate) => (
          <button className="table-row folder" key={candidate.id} onClick={() => onSelectCandidate(candidate)}>
            <span className="file-name"><FolderIcon />{candidate.name}</span><span>{candidate.date}</span><span>{candidate.signal}</span>
          </button>
        ))}
        {!visibleEntries.candidates.length && !visibleEntries.folders.length && (
          <div className="empty-table">
            {search.trim() ? 'No candidates or folders match your search.' : 'No candidate or custom folders exist yet.'}
          </div>
        )}
      </div>
      <FolderDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreate={createFolder} />
    </section>
  );
}
