import React from 'react';

export default function Progress({ steps, active }) {
  return <div className="progress">{steps.map((step, index) => <span className={index + 1 === active ? 'on' : ''} key={step}>{step}</span>)}</div>;
}
