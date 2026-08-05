import React from 'react';
import ArchiveIcon from '../../assets/icons/navigation/archive/ArchiveIcon.jsx';
import ChevronIcon from '../../assets/icons/navigation/chevron/ChevronIcon.jsx';
import HomeIcon from '../../assets/icons/navigation/home/HomeIcon.jsx';
import SettingsIcon from '../../assets/icons/navigation/settings/SettingsIcon.jsx';

export default function BottomNavigation({ activeDestination, navigationOpen, navigate, setNavigationOpen }) {
  const destinations = [
    { id: 'home', label: 'Home', icon: <HomeIcon /> },
    { id: 'archive', label: 'Archive', icon: <ArchiveIcon /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon /> }
  ];

  return (
    <div className={`bottom-navigation ${navigationOpen ? 'open' : ''}`}>
      <button
        className="nav-pull-tab"
        aria-controls="primary-navigation"
        aria-expanded={navigationOpen}
        aria-label={navigationOpen ? 'Close navigation' : 'Open navigation'}
        onClick={() => setNavigationOpen(!navigationOpen)}
      >
        <ChevronIcon />
      </button>
      <nav className="nav-drawer" id="primary-navigation" aria-label="Primary navigation">
        <div className="nav-drawer-heading"><span>Navigation</span></div>
        <div className="nav-items">
          {destinations.map((destination) => (
            <button
              className={`nav-item ${activeDestination === destination.id ? 'active' : ''}`}
              key={destination.id}
              aria-current={activeDestination === destination.id ? 'page' : undefined}
              onClick={() => navigate(destination.id)}
            >
              {destination.icon}
              <span>{destination.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <div className="nav-dock-status" aria-hidden="true">
        <span className="nav-dock-dot" />
        <span>{destinations.find((destination) => destination.id === activeDestination)?.label}</span>
      </div>
    </div>
  );
}
