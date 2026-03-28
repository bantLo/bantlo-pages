import { useEffect } from 'react';

const APP_VERSION_KEY = 'bantlo_current_version';

export async function checkVersion() {
  try {
    let fetchUrl = import.meta.env.VITE_VERSION_INFO_URL || '/version.info';
    let response = await fetch(fetchUrl, { cache: 'no-store' });
    if (!response.ok) return;
    
    const latestData = await response.json();
    const storedString = localStorage.getItem(APP_VERSION_KEY);
    const currentData = storedString ? JSON.parse(storedString) : null;
    
    // First load or missing data
    if (!currentData) {
      localStorage.setItem(APP_VERSION_KEY, JSON.stringify(latestData));
      return;
    }

    if (currentData.version !== latestData.version) {
      console.log('Update detected!', latestData.version);
      if (window.confirm(`A new version (${latestData.version}) of bantLo is available! Refuse to be stale—refresh now?`)) {
        localStorage.setItem(APP_VERSION_KEY, JSON.stringify(latestData));
        forceCacheUpdate();
      }
    } else {
      // Even if version is same, update the message/metadata if it changed
      localStorage.setItem(APP_VERSION_KEY, JSON.stringify(latestData));
    }
  } catch (error) {
    console.warn('[Version Poller] Check failed:', error);
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
