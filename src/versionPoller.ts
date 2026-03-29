import { useEffect } from 'react';

const APP_VERSION_KEY = 'bantlo_current_version';
const DEPLOYMENT_DELAY_MS = 5 * 60 * 1000; // 5 minute buffer for Cloudflare Pages edge Sync

export async function checkVersion() {
  try {
    let fetchUrl = import.meta.env.VITE_VERSION_INFO_URL || '/version.info';
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

    const storedString = localStorage.getItem(APP_VERSION_KEY);
    let currentData: any = null;

    try {
      if (storedString) {
        if (storedString.trim().startsWith('{')) {
          currentData = JSON.parse(storedString);
        } else {
          currentData = { version: storedString };
        }
      }
    } catch (e) {
      console.warn('[Version Poller] Stale local format');
    }
    
    // Always update local storage with the latest structure
    localStorage.setItem(APP_VERSION_KEY, JSON.stringify(latestData));

    if (currentData && currentData.version && currentData.version !== latestData.version) {
      console.log('New version found:', latestData.version);
      
      const publishedAt = latestData.published_at ? new Date(latestData.published_at).getTime() : 0;
      const isDeploymentReady = (Date.now() - publishedAt) >= DEPLOYMENT_DELAY_MS;

      if (isDeploymentReady) {
        setTimeout(() => {
          if (window.confirm(`A new version (${latestData.version}) of bantLo is available! Refuse to be stale—refresh now?`)) {
            forceCacheUpdate();
          }
        }, 500);
      } else {
        console.log('Deployment still in progress... waiting for edge sync.');
        latestData.status = 'Deploying...';
      }
    } else {
      latestData.status = 'Ready';
    }
    
    return latestData;
  } catch (error) {
    console.warn('[Version Poller] Check failed:', error);
    return null;
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
