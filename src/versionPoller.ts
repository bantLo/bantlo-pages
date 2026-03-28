import { useEffect } from 'react';

const LAST_VERSION_CHECK_KEY = 'bantlo_last_version_check';
const CHECK_INTERVAL_MS = 3.5 * 24 * 60 * 60 * 1000; // 3.5 days in ms

export async function checkVersion() {
  const lastCheck = localStorage.getItem(LAST_VERSION_CHECK_KEY);
  const now = Date.now();

  if (lastCheck && now - parseInt(lastCheck, 10) < CHECK_INTERVAL_MS) {
    console.log('[Version Poller] Cache is fresh, no need to check version yet.');
    return;
  }

  try {
    console.log('[Version Poller] Checking for app updates...');
    const response = await fetch('/version.info', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to fetch version info');
    
    const latestVersionInfo = await response.json();
    
    // In a real app we might store currentVersion in our config block or env vars
    // For now we'll dynamically grab the CURRENT cached version info if possible
    const currentResponse = await fetch('/version.info'); // from cache
    if (currentResponse.ok) {
      const currentVersionInfo = await currentResponse.json();
      if (latestVersionInfo.version !== currentVersionInfo.version || latestVersionInfo.updated_at !== currentVersionInfo.updated_at) {
        // App has an update
        if (window.confirm('A new version of bantLo is available. Refresh to update?')) {
          forceCacheUpdate();
          return;
        }
      }
    }
    
    // Update last check time
    localStorage.setItem(LAST_VERSION_CHECK_KEY, now.toString());

  } catch (error) {
    console.warn('[Version Poller] Error checking version:', error);
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
