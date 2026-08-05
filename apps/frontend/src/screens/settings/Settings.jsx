import React from 'react';
import PageHeader from '../../components/page-header/PageHeader.jsx';
import PasswordForm from '../../components/profile/password-form/PasswordForm.jsx';

export default function Settings({ profile, authenticationMethod, onChangePassword, theme, setTheme }) {
  return (
    <section>
      <PageHeader title="Settings" subtitle="Profile, appearance, archive, and export preferences" />
      <div className="settings-grid">
        <div className="card setting-card">
          <span className="eyebrow">Profile</span>
          <h2>{profile.displayName}</h2>
          <p>{profile.email}</p>
          <div className="input-list"><div>Role: {profile.role}</div><div>Account ID: {profile.userId}</div><div>Data access: Supabase RLS</div></div>
        </div>
        {authenticationMethod === 'supabase' && (
          <div className="card setting-card">
            <span className="eyebrow">Security</span>
            <h2>Password</h2>
            <p>Use a passphrase of at least 15 characters. Supabase Auth hashes passwords and the update signs out active sessions.</p>
            <PasswordForm onChangePassword={onChangePassword} />
          </div>
        )}
        <div className="card setting-card">
          <span className="eyebrow">Appearance</span>
          <h2>Theme</h2>
          <p>Choose how Ghost appears on this device.</p>
          <div className="theme-options" aria-label="Theme selection">
            <button className={theme === 'dark' ? 'active' : ''} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Dark</button>
            <button className={theme === 'light' ? 'active' : ''} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Light</button>
          </div>
        </div>
        <div className="card setting-card">
          <span className="eyebrow">Defaults</span>
          <h2>Workspace</h2>
          <div className="input-list"><div>Default export: ZIP</div><div>Signal language: Review-only</div><div>Archive scope: Current profile only</div></div>
        </div>
      </div>
    </section>
  );
}
