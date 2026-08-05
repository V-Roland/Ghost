import React from 'react';
import FolderIcon from '../../../assets/icons/content/folder/FolderIcon.jsx';
import Breadcrumb from '../../../components/breadcrumb/Breadcrumb.jsx';
import PageHeader from '../../../components/page-header/PageHeader.jsx';
import Toolbar from '../../../components/toolbar/Toolbar.jsx';

export default function ArchiveJob({ job, onSelectCandidate }) {
  const candidates = job.candidates.length ? job.candidates : [{ id: 'empty', name: 'No candidates yet', date: '-', interviews: 0, signal: 'Create a folder to start' }];

  return (
    <section>
      <Breadcrumb items={['Archive', job.name]} />
      <PageHeader title={job.name} subtitle="Candidate interview folders" actions={<><button>+ Folder</button><button className="primary">Export This Folder ZIP</button></>} />
      <Toolbar placeholder="Search candidates..." />
      <div className="table card">
        <div className="table-row head"><span>Candidate</span><span>Date</span><span>Signal</span></div>
        {candidates.map((candidate) => (
          <button className="table-row folder" key={candidate.id} disabled={candidate.id === 'empty'} onClick={() => onSelectCandidate(candidate)}>
            <span className="file-name"><FolderIcon />{candidate.name}</span><span>{candidate.date}</span><span>{candidate.signal}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
