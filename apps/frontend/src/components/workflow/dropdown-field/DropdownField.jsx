import React, { useEffect, useId, useRef, useState } from 'react';

export default function DropdownField({ label, onChange, options, value }) {
  const listId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(options.indexOf(value), 0));

  useEffect(() => {
    setActiveIndex(Math.max(options.indexOf(value), 0));
  }, [options, value]);

  useEffect(() => {
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);

  const selectOption = (option) => {
    onChange(option);
    setOpen(false);
  };

  return (
    <div className="workflow-field custom-dropdown-field" ref={rootRef}>
      <span>{label}</span>
      <div className="custom-dropdown-control">
        <button
          type="button"
          className="custom-dropdown-trigger"
          role="combobox"
          aria-controls={listId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => (index + 1) % options.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => (index - 1 + options.length) % options.length);
            } else if (event.key === 'Enter' && open) {
              event.preventDefault();
              selectOption(options[activeIndex]);
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
        >
          <span>{value}</span><span aria-hidden="true">⌄</span>
        </button>
        {open && (
          <div className="autocomplete-menu custom-dropdown-menu" id={listId} role="listbox">
            {options.map((option, index) => (
              <button
                type="button"
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option === value}
                className={index === activeIndex ? 'active' : ''}
                key={option}
                onClick={() => selectOption(option)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
