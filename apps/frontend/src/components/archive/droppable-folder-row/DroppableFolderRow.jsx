import React, { useState } from 'react';
import FolderIcon from '../../../assets/icons/content/folder/FolderIcon.jsx';
import { ARCHIVE_FILE_DRAG_TYPE } from '../../../domain/archive/archiveRecords.js';

export default function DroppableFolderRow({ folder, onFileDrop, onOpen }) {
  const [dropActive, setDropActive] = useState(false);
  const acceptsDrag = (event) => Array.from(event.dataTransfer.types).includes(ARCHIVE_FILE_DRAG_TYPE);

  return (
    <button
      type="button"
      className={`table-row file-table-row folder${dropActive ? ' folder-drop-target' : ''}`}
      onClick={() => onOpen(folder)}
      onDragEnter={(event) => {
        if (!acceptsDrag(event)) return;
        event.preventDefault();
        setDropActive(true);
      }}
      onDragOver={(event) => {
        if (!acceptsDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDropActive(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDropActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDropActive(false);
        const fileId = event.dataTransfer.getData(ARCHIVE_FILE_DRAG_TYPE);
        if (fileId) onFileDrop(fileId, folder);
      }}
    >
      <span className="file-name"><FolderIcon />{folder.name}</span>
      <span>Folder</span>
      <span>—</span>
      <span>{dropActive ? 'Drop file' : 'Open'}</span>
    </button>
  );
}
