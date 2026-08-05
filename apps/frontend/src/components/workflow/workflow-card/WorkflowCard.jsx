import React from 'react';

export default function WorkflowCard({ title, text, children }) {
  return <div className="workflow card"><h1>{title}</h1><p>{text}</p>{children}</div>;
}
