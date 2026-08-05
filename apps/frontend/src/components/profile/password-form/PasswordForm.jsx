import React, { useState } from 'react';

export default function PasswordForm({ onChangePassword }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setStatus('New passwords do not match.');
      return;
    }
    setSubmitting(true);
    setStatus('');
    try {
      await onChangePassword(currentPassword, newPassword);
    } catch (error) {
      setStatus(error.message || 'Password could not be changed.');
      setSubmitting(false);
    }
  };

  return (
    <form className="password-form" onSubmit={submit}>
      <label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
      <label>New passphrase<input type="password" autoComplete="new-password" minLength="15" maxLength="128" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
      <label>Confirm passphrase<input type="password" autoComplete="new-password" minLength="15" maxLength="128" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
      {status && <div className="auth-error" role="alert">{status}</div>}
      <button type="submit" disabled={submitting}>{submitting ? 'Updating…' : 'Change password and sign out'}</button>
    </form>
  );
}
