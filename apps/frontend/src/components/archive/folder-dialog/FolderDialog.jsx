import React, { useEffect, useState } from 'react';

export default function FolderDialog({ open, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setError('');
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;
  return (
    <div className="folder-dialog-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="folder-dialog card" role="dialog" aria-modal="true" aria-labelledby="folder-dialog-title" onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
          await onCreate(name);
          onClose();
        } catch (createError) {
          setError(createError.message || 'The folder could not be created.');
          setSaving(false);
        }
      }}>
        <h2 id="folder-dialog-title">Create Folder</h2>
        <p>Folders are saved to your profile's database-backed archive.</p>
        <label className="workflow-field">
          <span>Folder name</span>
          <input autoFocus type="text" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Folder name" required />
        </label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <div className="folder-dialog-actions">
          <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="primary" disabled={saving || !name.trim()}>{saving ? 'Creating…' : 'Create Folder'}</button>
        </div>
      </form>
    </div>
  );
}
