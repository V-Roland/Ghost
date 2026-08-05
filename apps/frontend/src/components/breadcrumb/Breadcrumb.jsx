import React from 'react';

export default function Breadcrumb({ items }) {
  return <div className="breadcrumb">{items.join(' › ')}</div>;
}
