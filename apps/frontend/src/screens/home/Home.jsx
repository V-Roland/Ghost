import React from 'react';

export default function Home({ profile, jobs, setScreen, setWorkflowStep }) {
  const recentJob = jobs[0];
  const recentCandidate = recentJob?.candidates[0];
  const firstName = profile.displayName.split(' ')[0];

  return (
    <section className="home-grid">
      <div className="hero card elevated">
        <span className="eyebrow">AI Interview Copilot</span>
        <h1>Welcome, {firstName}</h1>
        <p>Prepare role-specific questions, organize interview evidence, and surface review-only integrity signals without replacing human judgment.</p>
        <div className="home-actions">
          <button className="primary" onClick={() => { setWorkflowStep(1); setScreen('start'); }}>Start New Interview</button>
          <div className="pill-row">
            <button onClick={() => setScreen('archive')}>Archive</button>
            <button onClick={() => setScreen('settings')}>Settings</button>
            <button onClick={() => setScreen('report')}>Review Transcript</button>
          </div>
        </div>
      </div>
      <div className="card">
        <h2>Recent workspace</h2>
        {recentJob ? (
          <>
            <p className="muted">{recentJob.name}</p>
            <div className="mini-tree">{recentJob.name}<br />{recentCandidate ? `└── ${recentCandidate.name} - ${recentCandidate.date}` : '└── No interviews yet'}<br />&nbsp;&nbsp;&nbsp;&nbsp;├── Questions<br />&nbsp;&nbsp;&nbsp;&nbsp;└── Reports</div>
          </>
        ) : <p className="muted">No interviews have been created for this profile.</p>}
      </div>
    </section>
  );
}
