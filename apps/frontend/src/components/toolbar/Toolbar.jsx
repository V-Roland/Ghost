import React from 'react';

export default function Toolbar({ placeholder }) {
  return <div className="toolbar"><input placeholder={placeholder} /><button>Filters</button></div>;
}
