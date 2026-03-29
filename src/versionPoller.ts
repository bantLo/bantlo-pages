import { useEffect } from 'react';

const INSTALLED_VERSION_KEY = 'bantlo_installed_version';
const LATEST_VERSION_KEY = 'bantlo_latest_server_version';
const DEPLOYMENT_DELAY_MS = 2 * 60 * 1000; // 2 minute buffer for Cloudflare Sync

export async function checkVersion() {
  try {
    // 1. Direct fetch from deployment site with cache-busting timestamp
    let fetchUrl = `/version.info?t=${Date.now()}`;
    let response = await fetch(fetchUrl, { cache: 'no-store' });
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

    // 4. Update the "Latest Seen" record
    localStorage.setItem(LATEST_VERSION_KEY, JSON.stringify(latestData));

    // 5. Compare and Status logic
    if (installedVersion !== latestData.version) {
      console.log(`[Version Sync] Mismatch: Installed=${installedVersion}, Server=${latestData.version}`);
      
      const publishedAt = latestData.published_at ? new Date(latestData.published_at).getTime() : 0;
      const isDeploymentReady = (Date.now() - publishedAt) >= DEPLOYMENT_DELAY_MS;

      if (isDeploymentReady) {
        latestData.status = 'Update Available';
        // Auto-prompt logic (throttled by user interaction, usually checked in UI)
      } else {
        latestData.status = 'Syncing...';
      }
    } else {
      latestData.status = 'Up to Date';
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
