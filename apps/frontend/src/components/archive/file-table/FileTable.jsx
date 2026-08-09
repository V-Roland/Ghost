import React from 'react';
import FileIcon from '../../../assets/icons/content/file/FileIcon.jsx';
import { ARCHIVE_FILE_DRAG_TYPE } from '../../../domain/archive/archiveRecords.js';

export default function FileTable({ draggable = false, files, onDownload, onOpen, workingFileId }) {
  return (
    <>
      {files.map((file) => (
        <div
          className="table-row file-table-row archive-file-row"
          draggable={draggable && workingFileId !== file.id}
          key={file.id}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData(ARCHIVE_FILE_DRAG_TYPE, file.id);
          }}
        >
          <button type="button" className="file-name file-open-button" onClick={() => onOpen(file)} disabled={workingFileId === file.id}>
            <FileIcon />{file.name}
          </button>
          <span>{file.type}</span>
          <span>{file.size}</span>
          <div className="file-actions">
            <button type="button" onClick={() => onOpen(file)} disabled={workingFileId === file.id}>Open</button>
            <button type="button" onClick={() => onDownload(file)} disabled={workingFileId === file.id}>Download</button>
          </div>
        </div>
      ))}
    </>
  );
}
