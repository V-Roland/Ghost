import React from 'react';

export default function FolderPreview({ expanded }) {
  return (
    <div className="mini-tree">
      Senior Development Position 2026<br />└── Robert James - 7/18/26
      {expanded && <><br />&nbsp;&nbsp;&nbsp;&nbsp;├── Job Posting<br />&nbsp;&nbsp;&nbsp;&nbsp;├── Resume / CV<br />&nbsp;&nbsp;&nbsp;&nbsp;├── Links<br />&nbsp;&nbsp;&nbsp;&nbsp;├── Questions<br />&nbsp;&nbsp;&nbsp;&nbsp;└── Reports</>}
    </div>
  );
}
