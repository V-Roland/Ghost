import React from 'react';
import Upload from '../upload/Upload.jsx';

export default function ResumeForm({ files, notes, onFilesChange, onNotesChange }) {
  return (
    <div className="workflow-section">
      <Upload label="Resume or CV" files={files} multiple onFilesChange={onFilesChange} helper="Upload one or more approved resume or CV files as PDF, DOCX, or TXT." />
      <label className="workflow-field">
        <span>Resume and background details</span>
        <textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="Manually add experience, skills, portfolio context, or details not captured in an upload." rows="6" maxLength={20000} />
      </label>
    </div>
  );
}
