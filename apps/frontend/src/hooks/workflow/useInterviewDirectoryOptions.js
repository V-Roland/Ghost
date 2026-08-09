import { useEffect, useState } from 'react';
import { loadInterviewDirectories } from '../../services/archive/archiveService.js';

export default function useInterviewDirectoryOptions(enabled, jobPostingId) {
  const [folders, setFolders] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setError('');
    setLoading(true);
    loadInterviewDirectories(jobPostingId)
      .then((loadedFolders) => {
        if (!cancelled) setFolders(loadedFolders);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setFolders([]);
          setError(loadError.message || 'Archive directories could not be loaded.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [enabled, jobPostingId]);

  return { error, folders, loading };
}
