import React from 'react';

export default function Toolbar({ onChange, onFilter, placeholder, value = '' }) {
  return (
    <div className="toolbar">
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {onFilter && <button type="button" onClick={onFilter}>Filters</button>}
    </div>
  );
}
