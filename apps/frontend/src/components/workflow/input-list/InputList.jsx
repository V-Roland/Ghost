import React from 'react';

export default function InputList({ values }) {
  return <div className="input-list">{values.map((value) => <div key={value}>{value}</div>)}</div>;
}
