import React, { useMemo } from 'react';
import { WORK_ARRANGEMENTS } from '../../../domain/workflow/interviewDraft.js';
import { locationOptions } from '../../../domain/workflow/locationSuggestions.js';
import AutocompleteField from '../autocomplete-field/AutocompleteField.jsx';
import DropdownField from '../dropdown-field/DropdownField.jsx';
import Upload from '../upload/Upload.jsx';

export default function JobPostingForm({ jobPosting, positions, files, onFieldChange, onFilesChange }) {
  const locations = useMemo(() => locationOptions(positions), [positions]);
  const sourceHelper = files.length
    ? `Uploaded source: ${files[0].name}. The database will link this file to the position.`
    : jobPosting.id
      ? 'Existing position selected. You can still edit its details.'
      : 'No posting file selected. The database will use the manual position details below.';

  return (
    <div className="workflow-section">
      <Upload label="Job posting file" files={files} onFilesChange={onFilesChange} helper="Upload the source posting, or leave this empty and enter the position manually." />
      <div className="workflow-source" aria-live="polite"><strong>Position source</strong><span>{sourceHelper}</span></div>
      <div className="workflow-form-grid">
        <AutocompleteField
          label="Position title"
          value={jobPosting.title}
          onChange={(value) => onFieldChange('title', value)}
          options={positions.map((position) => position.name)}
          placeholder="Select an existing position or type a new one"
          maxLength={160}
          required
          helper="Uploaded files fill this from the filename when blank; existing positions appear here as you type."
        />
        <label className="workflow-field">
          <span>Department</span>
          <input type="text" value={jobPosting.department} onChange={(event) => onFieldChange('department', event.target.value)} placeholder="Engineering" maxLength={120} />
        </label>
        <AutocompleteField
          label="Location"
          value={jobPosting.location}
          onChange={(value) => onFieldChange('location', value)}
          options={locations}
          placeholder="Start typing a city"
          maxLength={160}
          helper="Choose an autofill suggestion or continue typing any location."
        />
        <DropdownField label="Work arrangement" value={jobPosting.workArrangement} options={WORK_ARRANGEMENTS} onChange={(value) => onFieldChange('workArrangement', value)} />
      </div>
      <label className="workflow-field">
        <span>Job posting details</span>
        <textarea value={jobPosting.description} onChange={(event) => onFieldChange('description', event.target.value)} placeholder="Paste or write the role description, required experience, responsibilities, and evaluation focus." rows="7" maxLength={20000} />
      </label>
    </div>
  );
}
