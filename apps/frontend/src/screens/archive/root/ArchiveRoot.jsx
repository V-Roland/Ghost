import React from 'react';
import FolderIcon from '../../../assets/icons/content/folder/FolderIcon.jsx';
import PageHeader from '../../../components/page-header/PageHeader.jsx';
import Toolbar from '../../../components/toolbar/Toolbar.jsx';

export default function ArchiveRoot({ profile, jobs, setScreen, setSelectedJob }) {
  return (
    <section>
      <PageHeader title="Archive" subtitle={`${profile.displayName}'s job postings`} actions={<><button>+ Folder</button><button className="primary">Export All ZIP</button></>} />
      <Toolbar placeholder="Search postings..." />
      <div className="table card">
        <div className="table-row head"><span>Name</span><span>Interviews</span><span>Updated</span></div>
        {jobs.map((job) => (
          <button className="table-row folder" key={job.id} onClick={() => { setSelectedJob(job); setScreen('job'); }}>
            <span className="file-name"><FolderIcon />{job.name}</span><span>{job.interviews}</span><span>{job.updated}</span>
          </button>
        ))}
        {!jobs.length && <div className="empty-table">No interviews have been created for this profile.</div>}
      </div>
    </section>
  );
}
