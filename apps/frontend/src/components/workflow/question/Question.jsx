import React from 'react';

export default function Question({ text }) {
  return <div className="question"><strong>{text}</strong><span>Medium · Review before saving</span></div>;
}
