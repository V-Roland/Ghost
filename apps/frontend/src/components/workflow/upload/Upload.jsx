import React from 'react';

export default function Upload({ label }) {
  return <div className="upload"><strong>{label}</strong><span>Drag and drop here · PDF, DOCX, TXT</span><button>Choose File</button></div>;
}
