import { useEffect, useState } from 'react';
import * as authService from '../../services/auth/authService.js';
import * as profileService from '../../services/profile/profileService.js';

function initials(displayName) {
  return displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function normalizedProfile(profile) {
  return profile ? { ...profile, initials: profile.initials || initials(profile.displayName) } : null;
}

export default function useActiveProfile() {
  const [activeProfile, setActiveProfile] = useState(null);
  const [authenticationMethod, setAuthenticationMethod] = useState(null);
  const [initializationError, setInitializationError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    try {
      unsubscribe = authService.onAuthenticationChange(() => {
        if (!cancelled) {
          setActiveProfile(null);
          setAuthenticationMethod(null);
        }
      });
    } catch (error) {
      setInitializationError(error.message || 'Authentication could not be initialized.');
      setLoading(false);
      return () => { cancelled = true; };
    }

    authService.loadSession()
      .then((session) => {
        if (cancelled || !session) return;
        setInitializationError('');
        setActiveProfile(normalizedProfile(session.profile));
        setAuthenticationMethod(session.authenticationMethod);
      })
      .catch((error) => {
        if (!cancelled) {
          setActiveProfile(null);
          setInitializationError(error.message || 'Authentication could not be initialized.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const login = async (credentials) => {
    const session = await authService.login(credentials);
    setInitializationError('');
    setActiveProfile(normalizedProfile(session.profile));
    setAuthenticationMethod(session.authenticationMethod);
  };

  const register = async (registration) => {
    const result = await authService.register(registration);
    if (!result.profile) return result;
    setInitializationError('');
    setActiveProfile(normalizedProfile(result.profile));
    setAuthenticationMethod(result.authenticationMethod);
    return result;
  };

  const signOut = async () => {
    await authService.logout().catch(() => null);
    setActiveProfile(null);
    setAuthenticationMethod(null);
  };

  const changePassword = async (currentPassword, newPassword) => {
    await authService.changePassword(currentPassword, newPassword);
    setActiveProfile(null);
    setAuthenticationMethod(null);
  };

  const updateProfile = async (update) => {
    const profile = normalizedProfile(await profileService.updateProfile(update));
    setActiveProfile(profile);
    return profile;
  };

  return {
    activeProfile,
    authenticationMethod,
    changePassword,
    initializationError,
    loading,
    login,
    register,
    signOut,
    updateProfile
  };
}
