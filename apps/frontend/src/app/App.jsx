import React, { useEffect, useMemo, useState } from 'react';
import BottomNavigation from '../components/navigation/BottomNavigation.jsx';
import TopBar from '../components/top-bar/TopBar.jsx';
import useActiveProfile from '../hooks/profile/useActiveProfile.js';
import CandidateFiles from '../screens/archive/candidate/CandidateFiles.jsx';
import ArchiveJob from '../screens/archive/job/ArchiveJob.jsx';
import ArchiveRoot from '../screens/archive/root/ArchiveRoot.jsx';
import ArchiveFolder from '../screens/archive/folder/ArchiveFolder.jsx';
import Home from '../screens/home/Home.jsx';
import ProfileSignIn from '../screens/profile/sign-in/ProfileSignIn.jsx';
import ProfileSignUp from '../screens/profile/sign-up/ProfileSignUp.jsx';
import Settings from '../screens/settings/Settings.jsx';
import StartWorkflow from '../screens/workflow/StartWorkflow.jsx';
import * as archiveService from '../services/archive/archiveService.js';
import { createInterviewWorkspace } from '../services/workflow/workflowService.js';

export default function App() {
  const {
    activeProfile,
    authenticationMethod,
    changePassword,
    initializationError,
    loading: profileLoading,
    login,
    register,
    signOut,
    updateProfile
  } = useActiveProfile();
  const [archiveRecords, setArchiveRecords] = useState([]);
  const [archiveError, setArchiveError] = useState('');
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [theme, setTheme] = useState(activeProfile?.themePreference || 'dark');
  const [screen, setScreen] = useState('home');
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [folderTrail, setFolderTrail] = useState([]);
  const [folderOrigin, setFolderOrigin] = useState('archive');
  const [workflowStep, setWorkflowStep] = useState(1);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [authenticationScreen, setAuthenticationScreen] = useState('sign-in');

  const rootClass = useMemo(() => `app ${theme}`, [theme]);
  const activeDestination = ['archive', 'job', 'candidate', 'folder'].includes(screen)
    ? 'archive'
    : screen === 'settings'
      ? 'settings'
      : 'home';

  useEffect(() => {
    if (!activeProfile) return;
    let cancelled = false;
    setArchiveRecords([]);
    setSelectedJob(null);
    setSelectedCandidate(null);
    setFolderTrail([]);
    setArchiveError('');
    setArchiveLoading(true);
    setTheme(activeProfile.themePreference || 'dark');
    setScreen('home');
    setAuthenticationScreen('sign-in');
    setNavigationOpen(false);
    setProfileOpen(false);
    archiveService.loadArchive()
      .then((jobs) => {
        if (cancelled) return;
        setArchiveRecords(jobs);
        setSelectedJob(jobs[0] || null);
        setSelectedCandidate(jobs[0]?.candidates[0] || null);
      })
      .catch((error) => {
        if (!cancelled) setArchiveError(error.message || 'The archive could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setArchiveLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeProfile?.id]);

  useEffect(() => {
    if (!navigationOpen && !profileOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setNavigationOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [navigationOpen, profileOpen]);

  const navigate = (destination) => {
    setScreen(destination);
    setFolderTrail([]);
    setNavigationOpen(false);
    setProfileOpen(false);
  };

  const handleSignOut = () => {
    signOut();
    setProfileOpen(false);
  };

  const handleSelectCandidate = async (candidate) => {
    setSelectedCandidate(candidate);
    setScreen('candidate');
    try {
      const files = await archiveService.loadInterviewFiles(candidate.interviewId);
      setSelectedCandidate((selected) => selected?.id === candidate.id ? { ...selected, files } : selected);
    } catch (error) {
      setArchiveError(error.message || 'Interview files could not be loaded.');
    }
  };

  const handleWorkflowComplete = async (draft) => {
    await createInterviewWorkspace(draft);
    const jobs = await archiveService.loadArchive();
    setArchiveRecords(jobs);
    setSelectedJob(jobs[0] || null);
    setSelectedCandidate(jobs[0]?.candidates[0] || null);
    setWorkflowStep(1);
    setScreen('archive');
  };

  const handleOpenFolder = (folder, origin) => {
    if (origin) {
      setFolderOrigin(origin);
      setFolderTrail([folder]);
    } else {
      setFolderTrail((current) => [...current, folder]);
    }
    setScreen('folder');
  };

  const handleFolderBack = () => {
    if (folderTrail.length > 1) {
      setFolderTrail((current) => current.slice(0, -1));
    } else {
      setFolderTrail([]);
      setScreen(folderOrigin);
    }
  };

  const handleSelectFolderInterview = (interview) => {
    const job = archiveRecords.find((record) => record.jobPostingId === interview.jobPostingId);
    const candidate = job?.candidates.find((record) => record.interviewId === interview.id);
    if (!job || !candidate) {
      setArchiveError('The selected interview could not be found in the current archive.');
      return;
    }
    setSelectedJob(job);
    handleSelectCandidate(candidate);
  };

  const handleThemeChange = async (nextTheme) => {
    const previousTheme = theme;
    setTheme(nextTheme);
    try {
      await updateProfile({ themePreference: nextTheme });
    } catch (error) {
      setTheme(previousTheme);
      setArchiveError(error.message || 'Your theme preference could not be saved.');
    }
  };

  if (profileLoading) {
    return <main className={rootClass}><div className="app-window profile-window"><div className="profile-loading">Checking secure session…</div></div></main>;
  }

  if (!activeProfile) {
    return (
      <main className={rootClass}>
        <div className="app-window profile-window">
          {authenticationScreen === 'sign-up' ? (
            <ProfileSignUp
              configurationError={initializationError}
              onRegister={register}
              onSignIn={() => setAuthenticationScreen('sign-in')}
            />
          ) : (
            <ProfileSignIn
              configurationError={initializationError}
              onLogin={login}
              onSignUp={() => setAuthenticationScreen('sign-up')}
            />
          )}
        </div>
      </main>
    );
  }

  return (
    <main className={rootClass}>
      <div className="app-window">
        <TopBar
          profile={activeProfile}
          profileOpen={profileOpen}
          setProfileOpen={setProfileOpen}
          onSignOut={handleSignOut}
        />
        {profileOpen && <button className="profile-scrim" aria-label="Close profile menu" onClick={() => setProfileOpen(false)} />}
        <div className="content-shell">
          {archiveError && <div className="auth-error" role="alert">{archiveError}</div>}
          {archiveLoading && <div className="profile-loading">Loading your archive…</div>}
          {screen === 'home' && <Home profile={activeProfile} jobs={archiveRecords} setScreen={setScreen} setWorkflowStep={setWorkflowStep} />}
          {screen === 'archive' && <ArchiveRoot profile={activeProfile} jobs={archiveRecords} setScreen={setScreen} setSelectedJob={setSelectedJob} onOpenFolder={handleOpenFolder} />}
          {screen === 'job' && selectedJob && <ArchiveJob job={selectedJob} onSelectCandidate={handleSelectCandidate} onOpenFolder={handleOpenFolder} />}
          {screen === 'candidate' && selectedJob && selectedCandidate && <CandidateFiles job={selectedJob} candidate={selectedCandidate} setScreen={setScreen} onOpenFolder={handleOpenFolder} />}
          {screen === 'folder' && folderTrail.length > 0 && <ArchiveFolder folderTrail={folderTrail} onBack={handleFolderBack} onOpenFolder={(folder) => handleOpenFolder(folder)} onSelectInterview={handleSelectFolderInterview} />}
          {screen === 'start' && <StartWorkflow step={workflowStep} setWorkflowStep={setWorkflowStep} setScreen={setScreen} onComplete={handleWorkflowComplete} positions={archiveRecords} />}
          {screen === 'settings' && <Settings profile={activeProfile} authenticationMethod={authenticationMethod} onChangePassword={changePassword} theme={theme} setTheme={handleThemeChange} />}
        </div>
        {navigationOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setNavigationOpen(false)} />}
        <BottomNavigation
          activeDestination={activeDestination}
          navigationOpen={navigationOpen}
          navigate={navigate}
          setNavigationOpen={setNavigationOpen}
        />
      </div>
    </main>
  );
}
