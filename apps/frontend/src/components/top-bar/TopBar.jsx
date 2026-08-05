import React from 'react';
import ProfileIcon from '../../assets/icons/profile/profile/ProfileIcon.jsx';
import ProfileMenu from '../profile/profile-menu/ProfileMenu.jsx';

export default function TopBar({ profile, profileOpen, setProfileOpen, onSignOut }) {
  return (
    <header className="topbar">
      <div className="brand"><span className="gmark">G</span><span>Ghost</span></div>
      <div className="top-actions">
        <button
          className="profile-button"
          aria-expanded={profileOpen}
          aria-haspopup="dialog"
          onClick={() => setProfileOpen(!profileOpen)}
        >
          <ProfileIcon />
          <span>{profile.displayName}</span>
        </button>
        {profileOpen && (
          <ProfileMenu
            activeProfile={profile}
            onSignOut={onSignOut}
          />
        )}
      </div>
    </header>
  );
}
