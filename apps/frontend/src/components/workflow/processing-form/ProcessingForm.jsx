import React from 'react';

export default function ProcessingForm({ notes, onNotesChange }) {
  return (
    <div className="workflow-section">
      <div className="workflow-notice">
        <strong>Manual preparation mode</strong>
        <span>Automated extraction is not enabled yet. Uploaded files will be stored securely, while interviewer-entered details remain the source of truth.</span>
      </div>
      <label className="workflow-field">
        <span>Interview preparation details</span>
        <textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="Add focus areas, competencies to explore, constraints, or preparation notes for the interviewer." rows="7" maxLength={20000} />
      </label>
    </div>
  );
}
