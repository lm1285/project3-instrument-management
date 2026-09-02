import { useState, useEffect } from 'react';

export interface SystemVersion {
  version: string;
  buildTime: string;
}

export const useSystemVersion = () => {
  const [versionInfo, setVersionInfo] = useState<SystemVersion | null>(null);

  useEffect(() => {
    // Fetch with cache busting to ensure we get the latest version after deployment
    fetch(`/version.json?t=${new Date().getTime()}`)
      .then(res => {
        if (!res.ok) {
            // Fallback if file doesn't exist yet (dev mode maybe)
            return { version: 'Dev', buildTime: new Date().toISOString() };
        }
        return res.json();
      })
      .then(data => setVersionInfo(data))
      .catch(err => {
        console.error('Failed to load version info', err);
        setVersionInfo({ version: 'Unknown', buildTime: '' });
      });
  }, []);

  return versionInfo;
};
