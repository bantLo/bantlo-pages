import { useEffect } from 'react';

const APP_VERSION_KEY = 'bantlo_current_version';

export async function checkVersion() {
  try {
    let fetchUrl = import.meta.env.VITE_VERSION_INFO_URL || '/version.info';
    let response = await fetch(fetchUrl, { cache: 'no-store' });
    if (!response.ok) return;
    
    const latestVersionString = await response.text();
    const currentVersionString = localStorage.getItem(APP_VERSION_KEY);
    
    // First load execution tracking bypass
    if (!currentVersionString) {
      localStorage.setItem(APP_VERSION_KEY, latestVersionString);
      return;
    }

    if (currentVersionString !== latestVersionString) {
      console.log('Update detected running in background!', latestVersionString);
      if (window.confirm('A robust new version of bantLo was detected! Would you like to refresh your app to apply it?')) {
        localStorage.setItem(APP_VERSION_KEY, latestVersionString);
        forceCacheUpdate();
      }
    }
  } catch (error) {
    console.warn('[Version Poller] Network unavailable, bypassing GitHub version check.');
  }
}

export function forceCacheUpdate() {
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'FORCE_UPDATE' });
  } else {
    // If no controller, just clear standard caches and reload
    caches.keys().then((names) => {
      for (let name of names) caches.delete(name);
    }).then(() => {
      window.location.reload();
    });
  }
}

// React Hook hook for auto initialization
export function useVersionChecker() {
  useEffect(() => {
    checkVersion();
  }, []);
}
