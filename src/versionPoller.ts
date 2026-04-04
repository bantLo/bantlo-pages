import { useEffect } from 'react';

const INSTALLED_VERSION_KEY = 'bantlo_installed_version';
const LATEST_VERSION_KEY = 'bantlo_latest_server_version';
export async function checkVersion() {
  try {
    // 1. Direct fetch from deployment site with cache-busting timestamp
    const fetchUrl = `/version.info?t=${Date.now()}`;
    const response = await fetch(fetchUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    
    const text = await response.text();
    let latestData: any = { version: '0.0.0' };
    
    try {
      if (text.trim().startsWith('{')) {
        latestData = JSON.parse(text);
      } else {
        latestData = { version: text.trim() };
      }
    } catch (e) {
      latestData = { version: text.trim() || 'Unknown' };
    }

    // 2. Identify what is currently "Installed" (Actually running in memory)
    let installedVersion = localStorage.getItem(INSTALLED_VERSION_KEY);
    
    // 3. First-run initialization: If no "installed" record exists, we are running the server's version.
    if (!installedVersion) {
      localStorage.setItem(INSTALLED_VERSION_KEY, latestData.version);
      installedVersion = latestData.version;
    }

    // 4. Update the "Latest Seen" record (always update this so the UI can compare)
    localStorage.setItem(LATEST_VERSION_KEY, JSON.stringify(latestData));

    // 5. Compare and Status logic - IMMEDIATELY TRIGGER IF VERSION MISMATCH
    if (installedVersion !== latestData.version) {
      console.log(`[Version Sync] NEW VERSION DETECTED: Installed=${installedVersion}, Server=${latestData.version}`);
      latestData.isUpdateAvailable = true;
    } else {
      latestData.isUpdateAvailable = false;
    }
    
    latestData.installed_version = installedVersion;
    return latestData;
  } catch (error) {
    console.warn('[Version Poller] Check failed:', error);
    return null;
  }
}

export function forceCacheUpdate() {
  // 1. Mark the latest seen version as officially "Installed" BEFORE reload
  const latestRaw = localStorage.getItem(LATEST_VERSION_KEY);
  if (latestRaw) {
    try {
      const latest = JSON.parse(latestRaw);
      localStorage.setItem(INSTALLED_VERSION_KEY, latest.version);
    } catch (e) {
      // Fallback if parsing fails
    }
  }

  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    console.log('[Version Sync] Signalling SW to flush shell caches...');
    navigator.serviceWorker.controller.postMessage({ type: 'FORCE_UPDATE' });
  } else {
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
