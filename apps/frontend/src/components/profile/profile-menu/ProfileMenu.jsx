import React from 'react';

export default function ProfileMenu({ activeProfile, onSignOut }) {
  return (
    <aside className="profile-menu" role="dialog" aria-label="Profile menu">
      <div className="profile-summary">
        <span className="profile-avatar large">{activeProfile.initials}</span>
        <div><strong>{activeProfile.displayName}</strong><span>{activeProfile.email}</span></div>
      </div>
      <div className="profile-scope"><span className="profile-scope-dot" />Private profile workspace</div>
      <button className="profile-sign-out" onClick={onSignOut}>Sign out</button>
      <p className="profile-demo-note">Access is bound to this verified Supabase account and protected by database row-level security.</p>
    </aside>
  );
}
