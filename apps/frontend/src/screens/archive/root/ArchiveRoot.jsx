import React, { useEffect, useMemo, useState } from 'react';
import FolderIcon from '../../../assets/icons/content/folder/FolderIcon.jsx';
import FolderDialog from '../../../components/archive/folder-dialog/FolderDialog.jsx';
import PageHeader from '../../../components/page-header/PageHeader.jsx';
import Toolbar from '../../../components/toolbar/Toolbar.jsx';
import * as archiveService from '../../../services/archive/archiveService.js';
import { exportArchiveZip } from '../../../services/archive/archiveFileService.js';

export default function ArchiveRoot({ profile, jobs, setScreen, setSelectedJob, onOpenFolder }) {
  const [folders, setFolders] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return { folders, jobs };
    return {
      folders: folders.filter((folder) => folder.name.toLocaleLowerCase().includes(query)),
      jobs: jobs.filter((job) => job.name.toLocaleLowerCase().includes(query))
    };
  }, [folders, jobs, search]);

  useEffect(() => {
    archiveService.loadArchiveFolders().then(setFolders).catch((loadError) => setError(loadError.message));
  }, [profile.id]);

  const createFolder = async (name) => {
    const folder = await archiveService.createArchiveFolder({ name });
    setFolders((current) => [...current, folder].sort((left, right) => left.name.localeCompare(right.name)));
  };

  const exportArchive = async () => {
    setExporting(true);
    setError('');
    try { await exportArchiveZip(); } catch (exportError) { setError(exportError.message || 'The archive ZIP could not be created.'); }
    finally { setExporting(false); }
  };

  return (
    <section>
      <PageHeader title="Archive" subtitle={`${profile.displayName}'s job postings`} actions={<><button type="button" onClick={() => setDialogOpen(true)}>+ Folder</button><button type="button" className="primary" onClick={exportArchive} disabled={exporting}>{exporting ? 'Creating ZIP…' : 'Download ZIP'}</button></>} />
      {error && <div className="auth-error" role="alert">{error}</div>}
      <Toolbar placeholder="Search postings and folders..." value={search} onChange={setSearch} />
      <div className="table card">
        <div className="table-row head"><span>Name</span><span>Interviews</span><span>Updated</span></div>
        {visibleEntries.folders.map((folder) => (
          <button className="table-row folder" key={folder.id} onClick={() => onOpenFolder(folder, 'archive')}>
            <span className="file-name"><FolderIcon />{folder.name}</span><span>—</span><span>{folder.updatedAt.slice(0, 10)}</span>
          </button>
        ))}
        {visibleEntries.jobs.map((job) => (
          <button className="table-row folder" key={job.id} onClick={() => { setSelectedJob(job); setScreen('job'); }}>
            <span className="file-name"><FolderIcon />{job.name}</span><span>{job.interviews}</span><span>{job.updated}</span>
          </button>
        ))}
        {!visibleEntries.jobs.length && !visibleEntries.folders.length && (
          <div className="empty-table">
            {search.trim() ? 'No archive entries match your search.' : 'No archive folders have been created for this profile.'}
          </div>
        )}
      </div>
      <FolderDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreate={createFolder} />
    </section>
  );
}
