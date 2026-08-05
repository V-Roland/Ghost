import React from 'react';
import FileIcon from '../../../assets/icons/content/file/FileIcon.jsx';
import Breadcrumb from '../../../components/breadcrumb/Breadcrumb.jsx';
import PageHeader from '../../../components/page-header/PageHeader.jsx';

export default function CandidateFiles({ job, candidate, setScreen }) {
  return (
    <section>
      <Breadcrumb items={['Archive', job.name, `${candidate.name} - ${candidate.date}`]} />
      <PageHeader title={candidate.name} subtitle={`Interview on ${candidate.date}`} actions={<><button>+ Folder</button><button>Upload</button><button className="primary">Export This Folder ZIP</button></>} />
      <div className="tabs"><span className="active">Files</span><span>Summary</span><span>Notes</span><span>Signals</span><span>Report</span></div>
      <div className="table card">
        <div className="table-row head"><span>Name</span><span>Type</span><span>Size</span></div>
        {candidate.files.map((file) => <div className="table-row" key={file.id}><span className="file-name"><FileIcon />{file.name}</span><span>{file.type}</span><span>{file.size}</span></div>)}
        {!candidate.files.length && <div className="empty-table">No files have been added to this interview.</div>}
      </div>
      <button className="ghost-link back" onClick={() => setScreen('job')}>Back to candidates</button>
    </section>
  );
}
