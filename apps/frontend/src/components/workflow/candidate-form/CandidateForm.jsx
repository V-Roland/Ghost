import React from 'react';

export default function CandidateForm({ candidate, onFieldChange }) {
  return (
    <div className="workflow-section">
      <div className="workflow-form-grid">
        <label className="workflow-field">
          <span>Candidate name</span>
          <input type="text" value={candidate.name} onChange={(event) => onFieldChange('name', event.target.value)} placeholder="Full name" maxLength={120} required />
        </label>
        <label className="workflow-field">
          <span>Interview date</span>
          <input type="date" value={candidate.interviewDate} onChange={(event) => onFieldChange('interviewDate', event.target.value)} required />
        </label>
        <label className="workflow-field">
          <span>Email</span>
          <input type="email" value={candidate.email} onChange={(event) => onFieldChange('email', event.target.value)} placeholder="candidate@example.com" maxLength={320} />
        </label>
        <label className="workflow-field">
          <span>Current title</span>
          <input type="text" value={candidate.currentTitle} onChange={(event) => onFieldChange('currentTitle', event.target.value)} placeholder="Current or most recent role" maxLength={120} />
        </label>
      </div>
      <label className="workflow-field">
        <span>Candidate details</span>
        <textarea value={candidate.notes} onChange={(event) => onFieldChange('notes', event.target.value)} placeholder="Add recruiter context, accommodations, interview goals, or other approved notes." rows="5" maxLength={20000} />
      </label>
    </div>
  );
}
