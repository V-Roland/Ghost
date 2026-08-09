import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

export default function AutocompleteField({
  helper,
  label,
  maxLength,
  onChange,
  options = [],
  placeholder,
  required = false,
  value
}) {
  const inputId = useId();
  const listId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const suggestions = useMemo(() => {
    const normalizedValue = value.trim().toLowerCase();
    return [...new Set(options)]
      .filter((option) => !normalizedValue || option.toLowerCase().includes(normalizedValue))
      .slice(0, 8);
  }, [options, value]);

  useEffect(() => {
    setActiveIndex(0);
  }, [value]);

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
    <div className="workflow-field autocomplete-field" ref={rootRef}>
      <label htmlFor={inputId}>{label}</label>
      <div className="autocomplete-control">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && suggestions.length > 0}
          aria-activedescendant={open && suggestions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          value={value}
          onChange={(event) => { onChange(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (!open || !suggestions.length) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((index) => (index + 1) % suggestions.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              selectOption(suggestions[activeIndex]);
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
        />
        {open && suggestions.length > 0 && (
          <div className="autocomplete-menu" id={listId} role="listbox">
            {suggestions.map((option, index) => (
              <button
                type="button"
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={index === activeIndex ? 'active' : ''}
                key={option}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
      {helper && <small>{helper}</small>}
    </div>
  );
}
