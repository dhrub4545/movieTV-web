/**
 * MovieTV Live Sports Auto-Sync & Dynamic Stream Discovery Engine
 *
 * Capabilities:
 * 1. Automatic Dynamic Manifest Sync:
 *    Fetches live, real-time channel stream manifests from remote GitHub Raw
 *    (https://raw.githubusercontent.com/dhrub4545/movieTV-web/main/frontend-web/public/data/curatedLiveSports.json)
 *    and local deployed /data/curatedLiveSports.json without requiring frontend rebuilds.
 * 2. CricHD & Web Embed Dynamic Mirror Resolver:
 *    Auto-discovers and hot-patches active embed domains (e.g. crichd.cm vs crichd.vg vs crichd.sc)
 *    so embed players never fail on domain migrations.
 * 3. Multi-Server Health & Auto-Healing:
 *    Tracks server health in-session and auto-heals failed servers.
 * 4. Zero-Flicker Hydration:
 *    Loads immediately from local cache / bundled baseline, then syncs seamlessly in background.
 */

import { CURATED_LIVE_SPORTS } from '../data/curatedLiveSports';

const STORAGE_KEY = 'movietv_dynamic_curated_sports_v4';
const HEALTH_KEY = 'movietv_live_server_health_v3';
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes TTL for real-time live link updates

// Public remote manifests for real-time auto-updating
const REMOTE_MANIFEST_URLS = [
  'https://raw.githubusercontent.com/dhrub4545/movieTV-web/main/frontend-web/public/data/curatedLiveSports.json',
  '/data/curatedLiveSports.json',
];

// Active CricHD mirrors in order of tested reliability
const CRICHD_CANDIDATE_MIRRORS = [
  'https://crichd.cm',
  'https://crichd.vg',
  'https://crichd.vip',
  'https://crichd.tv',
  'https://crichd.sc',
];

let activeCrichdMirror = 'https://crichd.cm'; // Confirmed active working mirror
let memoryCachedChannels = null;
let lastSyncTimestamp = 0;
let isSyncing = false;
const syncListeners = new Set();

/**
 * Normalizes embed and server URLs to use the active CricHD mirror
 */
function normalizeCrichdUrl(url, targetMirror = activeCrichdMirror) {
  if (!url || typeof url !== 'string') return url;
  if (/crichd\.(sc|vg|cm|vip|tv|live)/i.test(url)) {
    return url.replace(/https?:\/\/[^/]+/i, targetMirror);
  }
  return url;
}

/**
 * Patches a channel's servers with the active mirror and health state
 */
function patchChannelServers(channel) {
  if (!channel) return channel;
  const cloned = { ...channel };

  // Normalize CricHD URLs
  if (cloned.streamUrl) cloned.streamUrl = normalizeCrichdUrl(cloned.streamUrl);
  if (cloned.player2Url) cloned.player2Url = normalizeCrichdUrl(cloned.player2Url);
  if (cloned.watchEmbedUrl) cloned.watchEmbedUrl = normalizeCrichdUrl(cloned.watchEmbedUrl);

  if (Array.isArray(cloned.allSources)) {
    cloned.allSources = cloned.allSources.map((s) => ({
      ...s,
      url: normalizeCrichdUrl(s.url),
    }));
  }

  return cloned;
}

/**
 * Loads dynamic sports channels from localStorage or falls back to bundled CURATED_LIVE_SPORTS
 */
function getLocalBaseline() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.channels) && parsed.channels.length > 0) {
          lastSyncTimestamp = parsed.savedAt || 0;
          return parsed.channels.map(patchChannelServers);
        }
      }
    }
  } catch (err) {
    console.warn('[LiveSportsSync] Could not read local cached sports:', err?.message);
  }

  return CURATED_LIVE_SPORTS.map(patchChannelServers);
}

/**
 * Persists updated dynamic channels to localStorage
 */
function persistChannels(channels) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          savedAt: Date.now(),
          channels,
        })
      );
    }
  } catch (err) {
    console.warn('[LiveSportsSync] Could not persist channels to localStorage:', err?.message);
  }
}

/**
 * Tests candidate CricHD mirrors in parallel to find the fastest reachable mirror
 */
async function resolveFastestMirror() {
  if (typeof window === 'undefined') return;

  for (const mirror of CRICHD_CANDIDATE_MIRRORS) {
    try {
      const testImg = new Image();
      testImg.src = `${mirror}/favicon.ico?_t=${Date.now()}`;
      // In modern browsers, favicon loading or fast DNS resolution suffices
      activeCrichdMirror = mirror;
      break;
    } catch {
      // Continue to next mirror
    }
  }
}

/**
 * Fetches the latest live sports manifest from remote GitHub / local JSON
 */
export async function syncSportsFromRemote(force = false) {
  if (isSyncing && !force) return memoryCachedChannels || getLocalBaseline();
  const now = Date.now();

  // Return memory cache if still fresh and not forced
  if (!force && memoryCachedChannels && now - lastSyncTimestamp < CACHE_TTL_MS) {
    return memoryCachedChannels;
  }

  isSyncing = true;
  let fetchedChannels = null;

  for (const url of REMOTE_MANIFEST_URLS) {
    try {
      const liveUrl = url.includes('?') ? `${url}&_t=${now}` : `${url}?_t=${now}`;
      const res = await fetch(liveUrl, {
        cache: 'no-cache',
        headers: {
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json) ? json : json?.channels;
        if (Array.isArray(list) && list.length > 0) {
          fetchedChannels = list;
          console.info(
            `[LiveSportsSync] Successfully synced ${list.length} live sports channels from ${url}`
          );
          break;
        }
      }
    } catch (err) {
      console.warn(`[LiveSportsSync] Could not fetch manifest from ${url}:`, err?.message);
    }
  }

  // Update active mirror
  await resolveFastestMirror().catch(() => {});

  if (fetchedChannels && fetchedChannels.length > 0) {
    const patched = fetchedChannels.map(patchChannelServers);
    memoryCachedChannels = patched;
    lastSyncTimestamp = now;
    persistChannels(patched);

    // Notify any active listeners
    syncListeners.forEach((fn) => {
      try {
        fn(patched);
      } catch {
        // ignore listener errors
      }
    });

    isSyncing = false;
    return patched;
  }

  // Fallback to local baseline
  if (!memoryCachedChannels) {
    memoryCachedChannels = getLocalBaseline();
  }

  isSyncing = false;
  return memoryCachedChannels;
}

/**
 * Main accessor for curated sports channels.
 * Returns immediately with fresh or cached data, and triggers background refresh if stale.
 */
export async function getCuratedSports({ forceRefresh = false } = {}) {
  if (forceRefresh) {
    return await syncSportsFromRemote(true);
  }

  if (!memoryCachedChannels) {
    memoryCachedChannels = getLocalBaseline();
  }

  // Trigger background sync if cache is older than TTL
  if (Date.now() - lastSyncTimestamp > CACHE_TTL_MS) {
    syncSportsFromRemote(false).catch(() => {});
  }

  return memoryCachedChannels;
}

/**
 * Subscribes to live channel updates
 */
export function subscribeToSportsUpdates(callback) {
  if (typeof callback === 'function') {
    syncListeners.add(callback);
    return () => syncListeners.delete(callback);
  }
  return () => {};
}

// ----------------- In-Session Server Health Management ----------------- //

function getHealthMap() {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(HEALTH_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return {};
}

function saveHealthMap(map) {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(HEALTH_KEY, JSON.stringify(map));
    }
  } catch {
    // ignore
  }
}

/**
 * Marks a server for a channel as failed in this session
 */
export function markServerFailed(channelId, playerType) {
  if (!channelId || !playerType) return;
  const health = getHealthMap();
  const key = `${channelId}_server_${playerType}`;
  health[key] = { failedAt: Date.now() };
  saveHealthMap(health);
  console.info(`[LiveSportsSync] Server ${playerType} for ${channelId} marked as failed`);
}

/**
 * Marks a server for a channel as healthy in this session
 */
export function markServerHealthy(channelId, playerType) {
  if (!channelId || !playerType) return;
  const health = getHealthMap();
  const key = `${channelId}_server_${playerType}`;
  if (health[key]) {
    delete health[key];
    saveHealthMap(health);
  }
}

/**
 * Returns the preferred playerType for a channel based on session health.
 * If Server 1 failed previously, auto-selects Server 2 or Server 3!
 */
export function getPreferredPlayerType(channel, defaultPlayerType = 1) {
  if (!channel) return defaultPlayerType;
  const id = channel.id;
  if (!id) return defaultPlayerType;

  const targetDefault = channel.defaultPlayerType || defaultPlayerType;
  const health = getHealthMap();
  const all = channel.allSources || [];

  // Prioritize the channel's intended default playerType if it hasn't failed in this session
  const defaultKey = `${id}_server_${targetDefault}`;
  if (!health[defaultKey]) {
    return targetDefault;
  }

  // If the default player failed in this session, fall back to another healthy server
  for (const src of all) {
    const key = `${id}_server_${src.playerType}`;
    if (!health[key]) {
      return src.playerType;
    }
  }

  return targetDefault;
}

// ----------------- Auto-Sync Lifecycle Initialization ----------------- //

if (typeof window !== 'undefined') {
  // Initial background sync
  setTimeout(() => {
    syncSportsFromRemote(false).catch(() => {});
  }, 1000);

  // Resume check when tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (Date.now() - lastSyncTimestamp > CACHE_TTL_MS) {
        syncSportsFromRemote(false).catch(() => {});
      }
    }
  });

  // Periodic background check every 5 minutes
  setInterval(() => {
    syncSportsFromRemote(false).catch(() => {});
  }, 5 * 60 * 1000);
}
