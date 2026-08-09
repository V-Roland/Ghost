import React, { useId, useRef, useState } from 'react';
import { readableFileSize } from '../../../domain/archive/archiveRecords.js';
import { MAX_UPLOAD_BYTES } from '../../../domain/workflow/interviewDraft.js';

export default function Upload({
  accept = '.pdf,.doc,.docx,.txt',
  files = [],
  helper = 'PDF, DOCX, or TXT up to 50 MB',
  label,
  multiple = false,
  onFilesChange
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [error, setError] = useState('');

  const addFiles = (fileList) => {
    const incomingFiles = [...fileList];
    const oversizedFile = incomingFiles.find((file) => file.size > MAX_UPLOAD_BYTES);
    if (oversizedFile) {
      setError(`${oversizedFile.name} is larger than 50 MB.`);
      return;
    }
    const selectedFiles = multiple ? incomingFiles : incomingFiles.slice(0, 1);
    const existingKeys = new Set(files.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
    const nextFiles = multiple
      ? [...files, ...selectedFiles.filter((file) => !existingKeys.has(`${file.name}:${file.size}:${file.lastModified}`))]
      : selectedFiles;
    setError('');
    onFilesChange(nextFiles);
  };

  const removeFile = (index) => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index));

  return (
    <div className="upload">
      <strong>{label}</strong>
      <span>{helper}</span>
      <div className="upload-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}>
        <input
          ref={inputRef}
          id={inputId}
          className="upload-input"
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }}
        />
        <span>Drag and drop files here, or</span>
        <button type="button" onClick={() => inputRef.current?.click()}>Choose {multiple ? 'Files' : 'File'}</button>
      </div>
      {error && <span className="workflow-field-error" role="alert">{error}</span>}
      {files.length > 0 && (
        <div className="upload-files" aria-live="polite">
          {files.map((file, index) => (
            <div className="upload-file" key={`${file.name}-${file.size}-${file.lastModified}`}>
              <span><strong>{file.name}</strong><small>{readableFileSize(file.size)}</small></span>
              <button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
