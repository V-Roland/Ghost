import React from 'react';
import { archiveDirectoryOptions } from '../../../domain/archive/archiveDirectories.js';
import DropdownField from '../dropdown-field/DropdownField.jsx';

const DEFAULT_DIRECTORY = 'Default position folder';

export default function DirectoryPicker({ error, folders, loading, onChange, value }) {
  const choices = archiveDirectoryOptions(folders);
  const selectedChoice = choices.find((choice) => choice.id === value);
  const labels = [DEFAULT_DIRECTORY, ...choices.map((choice) => choice.label)];

  const selectDirectory = (label) => {
    const choice = choices.find((option) => option.label === label);
    onChange(choice?.id || null);
  };

  return (
    <div className="directory-picker">
      <DropdownField
        label="Save interview in"
        onChange={selectDirectory}
        options={labels}
        value={selectedChoice?.label || DEFAULT_DIRECTORY}
      />
      <p className="workflow-field-help">
        {loading
          ? 'Loading your database-backed directories…'
          : choices.length
            ? 'Optional. The interview remains under its position and also appears inside the selected directory.'
            : 'No custom directories are available yet. You can create them from Archive.'}
      </p>
      {error && <div className="auth-error" role="alert">{error}</div>}
    </div>
  );
}
