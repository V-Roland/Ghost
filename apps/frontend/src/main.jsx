import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { jobPostings, candidateFiles } from './data/mockData.js';
import './styles.css';

function App() {
  const [theme, setTheme] = useState('dark');
  const [screen, setScreen] = useState('home');
  const [selectedJob, setSelectedJob] = useState(jobPostings[0]);
  const [selectedCandidate, setSelectedCandidate] = useState(jobPostings[0].candidates[0]);
  const [workflowStep, setWorkflowStep] = useState(1);

  const rootClass = useMemo(() => `app ${theme}`, [theme]);

  return (
    <main className={rootClass}>
      <div className="app-window">
        <TopBar theme={theme} setTheme={setTheme} />
        <div className="content-shell">
          {screen === 'home' && <Home setScreen={setScreen} setWorkflowStep={setWorkflowStep} />}
          {screen === 'archive' && <ArchiveRoot setScreen={setScreen} setSelectedJob={setSelectedJob} />}
          {screen === 'job' && <ArchiveJob job={selectedJob} setScreen={setScreen} setSelectedCandidate={setSelectedCandidate} />}
          {screen === 'candidate' && <CandidateFiles job={selectedJob} candidate={selectedCandidate} setScreen={setScreen} />}
          {screen === 'start' && <StartWorkflow step={workflowStep} setWorkflowStep={setWorkflowStep} setScreen={setScreen} />}
          {screen === 'settings' && <Settings />}
        </div>
      </div>
    </main>
  );
}

function TopBar({ theme, setTheme }) {
  return (
    <header className="topbar">
      <div className="brand"><span className="gmark">G</span><span>Ghost</span></div>
      <div className="top-actions">
        <button className="ghost-link" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
        <span className="window-dot" /><span className="window-dot" /><span className="window-dot" />
      </div>
    </header>
  );
}

function Home({ setScreen, setWorkflowStep }) {
  return (
    <section className="home-grid">
      <div className="hero card elevated">
        <span className="eyebrow">AI Interview Copilot</span>
        <h1>Welcome to Ghost</h1>
        <p>Prepare role-specific questions, organize interview evidence, and surface review-only integrity signals without replacing human judgment.</p>
        <button className="primary" onClick={() => { setWorkflowStep(1); setScreen('start'); }}>Start New Interview</button>
        <div className="pill-row">
          <button onClick={() => setScreen('archive')}>Archive</button>
          <button onClick={() => setScreen('settings')}>Settings</button>
        </div>
      </div>
      <div className="card">
        <h2>Recent workspace</h2>
        <p className="muted">Senior Development Position 2026</p>
        <div className="mini-tree">Senior Development Position 2026<br />└── Robert James - 7/18/26<br />&nbsp;&nbsp;&nbsp;&nbsp;├── Questions<br />&nbsp;&nbsp;&nbsp;&nbsp;└── Reports</div>
      </div>
    </section>
  );
}

function ArchiveRoot({ setScreen, setSelectedJob }) {
  return (
    <section>
      <PageHeader title="Archive" subtitle="Job Postings" actions={<><button>+ Folder</button><button className="primary">Export All ZIP</button></>} />
      <Toolbar placeholder="Search postings..." />
      <div className="table card">
        <div className="table-row head"><span>Name</span><span>Interviews</span><span>Updated</span></div>
        {jobPostings.map((job) => (
          <button className="table-row folder" key={job.id} onClick={() => { setSelectedJob(job); setScreen('job'); }}>
            <span>📁 {job.name}</span><span>{job.interviews}</span><span>{job.updated}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ArchiveJob({ job, setScreen, setSelectedCandidate }) {
  const candidates = job.candidates.length ? job.candidates : [{ id: 'empty', name: 'No candidates yet', date: '-', interviews: 0, signal: 'Create a folder to start' }];
  return (
    <section>
      <Breadcrumb items={['Archive', job.name]} />
      <PageHeader title={job.name} subtitle="Candidate interview folders" actions={<><button>+ Folder</button><button className="primary">Export This Folder ZIP</button></>} />
      <Toolbar placeholder="Search candidates..." />
      <div className="table card">
        <div className="table-row head"><span>Candidate</span><span>Date</span><span>Signal</span></div>
        {candidates.map((candidate) => (
          <button className="table-row folder" key={candidate.id} onClick={() => { setSelectedCandidate(candidate); setScreen('candidate'); }}>
            <span>📂 {candidate.name}</span><span>{candidate.date}</span><span>{candidate.signal}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function CandidateFiles({ job, candidate, setScreen }) {
  return (
    <section>
      <Breadcrumb items={['Archive', job.name, `${candidate.name} - ${candidate.date}`]} />
      <PageHeader title={candidate.name} subtitle={`Interview on ${candidate.date}`} actions={<><button>+ Folder</button><button>Upload</button><button className="primary">Export This Folder ZIP</button></>} />
      <div className="tabs"><span className="active">Files</span><span>Summary</span><span>Notes</span><span>Signals</span><span>Report</span></div>
      <div className="table card">
        <div className="table-row head"><span>Name</span><span>Type</span><span>Size</span></div>
        {candidateFiles.map((file) => <div className="table-row" key={file.name}><span>📄 {file.name}</span><span>{file.type}</span><span>{file.size}</span></div>)}
      </div>
      <button className="ghost-link back" onClick={() => setScreen('job')}>Back to candidates</button>
    </section>
  );
}

function StartWorkflow({ step, setWorkflowStep, setScreen }) {
  const steps = ['Job Posting', 'Candidate', 'Resume', 'Processing', 'Supplements', 'Review'];
  const next = () => step < 6 ? setWorkflowStep(step + 1) : setScreen('archive');
  const back = () => step > 1 ? setWorkflowStep(step - 1) : setScreen('home');
  return (
    <section>
      <Progress steps={steps} active={step} />
      {step === 1 && <WorkflowCard title="Upload the job posting" text="Ghost uses the posting to understand the role, required skills, seniority, and evaluation focus."><Upload label="Job Posting File" /><InputList values={['Senior Development Position 2026', 'Engineering', 'Remote / Hybrid']} /></WorkflowCard>}
      {step === 2 && <WorkflowCard title="Add candidate details" text="This creates the candidate interview folder inside the selected job posting archive."><InputList values={['Robert James', 'July 18, 2026', 'robert.james@example.com', 'Backend Engineer']} /><FolderPreview /></WorkflowCard>}
      {step === 3 && <WorkflowCard title="Add resume, CV, or links" text="Add approved materials so Ghost can tailor questions to the candidate’s actual background."><Upload label="Resume / CV Upload" /><InputList values={['GitHub · https://github.com/...', 'Portfolio · https://portfolio...']} /></WorkflowCard>}
      {step === 4 && <WorkflowCard title="Preparing workspace" text="Ghost is organizing files and extracting interview context for question generation."><Checklist /><FolderPreview expanded /></WorkflowCard>}
      {step === 5 && <WorkflowCard title="Build interview questions" text="Generate tailored questions or add your own bank before the interview begins."><div className="choice-row"><div className="choice active">Generate with Ghost<br /><span>Recommended</span></div><div className="choice">Add question bank<br /><span>Manual input</span></div></div><InputList values={['Focus on system design, debugging, collaboration, and cloud architecture.', 'Difficulty: Balanced', 'Questions: 10']} /></WorkflowCard>}
      {step === 6 && <WorkflowCard title="Review generated questions" text="Edit, remove, reorder, or approve questions before saving them to the interview folder."><Question text="Design a scalable API for processing transcript events." /><Question text="Walk through debugging a delayed cloud service." /><FolderPreview expanded /></WorkflowCard>}
      <div className="footer-actions"><button onClick={back}>Back</button><button className="primary" onClick={next}>{step === 6 ? 'Save Set' : 'Next'}</button></div>
    </section>
  );
}

function PageHeader({ title, subtitle, actions }) { return <div className="page-header"><div><h1>{title}</h1><p>{subtitle}</p></div><div className="action-row">{actions}</div></div>; }
function Toolbar({ placeholder }) { return <div className="toolbar"><input placeholder={placeholder} /><button>Filters</button></div>; }
function Breadcrumb({ items }) { return <div className="breadcrumb">{items.join(' › ')}</div>; }
function Progress({ steps, active }) { return <div className="progress">{steps.map((s, i) => <span className={i + 1 === active ? 'on' : ''} key={s}>{s}</span>)}</div>; }
function WorkflowCard({ title, text, children }) { return <div className="workflow card"><h1>{title}</h1><p>{text}</p>{children}</div>; }
function Upload({ label }) { return <div className="upload"><strong>{label}</strong><span>Drag and drop here · PDF, DOCX, TXT</span><button>Choose File</button></div>; }
function InputList({ values }) { return <div className="input-list">{values.map(v => <div key={v}>{v}</div>)}</div>; }
function FolderPreview({ expanded }) { return <div className="mini-tree">Senior Development Position 2026<br />└── Robert James - 7/18/26{expanded && <><br />&nbsp;&nbsp;&nbsp;&nbsp;├── Job Posting<br />&nbsp;&nbsp;&nbsp;&nbsp;├── Resume / CV<br />&nbsp;&nbsp;&nbsp;&nbsp;├── Links<br />&nbsp;&nbsp;&nbsp;&nbsp;├── Questions<br />&nbsp;&nbsp;&nbsp;&nbsp;└── Reports</>}</div>; }
function Checklist() { return <div className="input-list"><div>✓ Job posting saved</div><div>✓ Candidate folder created</div><div>✓ Resume uploaded</div><div>○ Extracting key skills</div><div>○ Preparing question workspace</div></div>; }
function Question({ text }) { return <div className="question"><strong>{text}</strong><span>Medium · Review before saving</span></div>; }
function Settings() { return <section><PageHeader title="Settings" subtitle="Profile, theme, archive, and export preferences" actions={<button className="primary">Save</button>} /><div className="card"><h2>Defaults</h2><div className="input-list"><div>Theme: System</div><div>Default export: ZIP</div><div>Signal language: Review-only</div></div></div></section>; }

createRoot(document.getElementById('root')).render(<App />);
