/**
 * MovieTV Web API Client
 * Features:
 * - Configurable Backend URL with localStorage persistence
 * - Ignores legacy '192.168.100.14' addresses
 * - In-memory caching for Tabs, Channels, and Series details
 * - 5-minute TTL caching
 */

const STORAGE_KEY = 'movietv_server_url';
export const DEFAULT_BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_API_URL || import.meta.env?.VITE_BACKEND_URL)) ||
  'https://movietvbackend.vercel.app';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-Memory Tab Caches
export const tabCaches = {
  indian: {
    items: [],
    currentPage: 1,
    hasMorePages: true,
    lastLoadedTime: 0,
  },
  global: {
    items: [],
    currentPage: 1,
    hasMorePages: true,
    lastLoadedTime: 0,
  },
  series: {
    items: [],
    currentPage: 1,
    hasMorePages: true,
    lastLoadedTime: 0,
  },
};

// In-Memory Channel Cache: { [category]: channels[] }
export const channelCache = new Map();

// In-Memory Series Details Cache: { [id]: seasons[] }
export const seriesDetailsCache = new Map();

// In-Memory Stream Resolution Cache: { [cacheKey]: resolvedResult }
export const streamResolutionCache = new Map();

/**
 * Normalizes a URL: ensures protocol and removes trailing slashes.
 */
function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return DEFAULT_BASE_URL;
  let clean = url.trim();
  if (
    clean.includes('192.168.100.14') ||
    clean.includes('localhost:5000') ||
    clean.includes('127.0.0.1:5000')
  ) {
    return DEFAULT_BASE_URL;
  }
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  return clean.replace(/\/+$/, '');
}

/**
 * Gets the current configured Backend URL.
 */
export function getServerUrl() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (
      saved &&
      !saved.includes('192.168.100.14') &&
      !saved.includes('localhost:5000') &&
      !saved.includes('127.0.0.1:5000') &&
      saved.trim().length > 0
    ) {
      return normalizeUrl(saved);
    }
  } catch (err) {
    console.warn('Could not read localStorage:', err?.message);
  }
  return DEFAULT_BASE_URL;
}

/**
 * Sets and persists a new Backend URL.
 */
export function setServerUrl(newUrl) {
  const normalized = normalizeUrl(newUrl);
  try {
    localStorage.setItem(STORAGE_KEY, normalized);
  } catch (err) {
    console.warn('Could not save to localStorage:', err?.message);
  }
  return normalized;
}

/**
 * Resets Backend URL to Vercel default.
 */
export function resetServerUrl() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return DEFAULT_BASE_URL;
}

/**
 * Tests connection latency and health for a given backend URL.
 */
export function testServerUrl(candidateUrl) {
  const target = normalizeUrl(candidateUrl);
  const start = performance.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  return fetch(`${target}/api/channels/categories`, {
    signal: controller.signal,
    headers: { Accept: 'application/json' },
  })
    .then((res) => {
      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        return { success: true, latency, url: target };
      }
      return { success: false, error: `HTTP ${res.status}`, latency, url: target };
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      return {
        success: false,
        error: err.name === 'AbortError' ? 'Connection timed out (7s)' : err.message,
        url: target,
      };
    });
}

/**
 * Generic fetch wrapper with automatic timeout and JSON parsing.
 */
async function apiFetch(endpoint, options = {}) {
  const base = getServerUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${base}${cleanEndpoint}`;

  const controller = new AbortController();
  const timeout = options.timeout || 15000;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(fullUrl, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout / 1000}s`);
    }
    throw err;
  }
}

// ----------------- API Methods ----------------- //

export async function getHomeFeed() {
  return apiFetch('/api/feed/home');
}

export async function getLatest({ page = 1, limit = 40, search = '' } = {}) {
  const params = new URLSearchParams();
  if (page) params.set('page', page);
  if (limit) params.set('limit', limit);
  if (search) params.set('search', search);
  return apiFetch(`/api/feed/latest?${params.toString()}`);
}

export async function getMovies({ category = 'indian', page = 1, limit = 40, search = '' } = {}) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (page) params.set('page', page);
  if (limit) params.set('limit', limit);
  if (search) params.set('search', search);
  return apiFetch(`/api/feed/movies?${params.toString()}`);
}

export async function getSeries({ page = 1, limit = 40, search = '' } = {}) {
  const params = new URLSearchParams();
  if (page) params.set('page', page);
  if (limit) params.set('limit', limit);
  if (search) params.set('search', search);
  return apiFetch(`/api/feed/series?${params.toString()}`);
}

export async function getMovieDetails(id) {
  return apiFetch(`/api/feed/movie/${encodeURIComponent(id)}`);
}

export async function getSeriesDetails(id) {
  // Check in-memory cache first
  if (seriesDetailsCache.has(id)) {
    return seriesDetailsCache.get(id);
  }
  const data = await apiFetch(`/api/feed/series/${encodeURIComponent(id)}`);
  if (data && (data.seasons || data.item)) {
    const seasons = data.seasons || data.item?.seasons || [];
    seriesDetailsCache.set(id, { ...data, seasons });
  }
  return data;
}

export async function getChannelCategories() {
  return apiFetch('/api/channels/categories');
}

export async function getChannels({ category = '', refresh = false } = {}) {
  const cacheKey = category || 'All';
  if (!refresh && channelCache.has(cacheKey)) {
    return { channels: channelCache.get(cacheKey), fromCache: true };
  }

  const params = new URLSearchParams();
  if (category && category !== 'All') params.set('category', category);
  if (refresh) params.set('refresh', 'true');

  const data = await apiFetch(`/api/channels?${params.toString()}`);
  const channels = data?.channels || [];
  channelCache.set(cacheKey, channels);
  return { channels, total: data?.total || channels.length, fromCache: false };
}

export async function resolveStream({
  id = '',
  tmdbId = null,
  title = '',
  type = 'movie',
  season = 1,
  episode = 1,
  refresh = false,
} = {}) {
  const cacheKey = `${id}_${title}_${type}_${season}_${episode}`;
  if (!refresh && streamResolutionCache.has(cacheKey)) {
    return streamResolutionCache.get(cacheKey);
  }

  const params = new URLSearchParams();
  if (id) params.set('id', id);
  if (tmdbId) params.set('tmdbId', tmdbId);
  if (title) params.set('title', title);
  if (type) params.set('type', type);
  if (season) params.set('season', season);
  if (episode) params.set('episode', episode);
  if (refresh) params.set('refresh', 'true');

  const data = await apiFetch(`/api/stream/resolve?${params.toString()}`);
  if (data) {
    streamResolutionCache.set(cacheKey, data);
  }
  return data;
}

export async function searchApi(query) {
  if (!query || !query.trim()) {
    return { media: [], channels: [] };
  }
  const params = new URLSearchParams({ q: query.trim() });
  return apiFetch(`/api/search?${params.toString()}`);
}

export async function saveM3u8({
  id,
  title,
  type = 'movie',
  season,
  episode,
  m3u8Url,
  player = 1,
}) {
  return apiFetch('/api/stream/save-m3u8', {
    method: 'POST',
    body: JSON.stringify({
      id,
      title,
      type,
      season,
      episode,
      m3u8Url,
      player,
    }),
  });
}

export async function reportCrash(report) {
  try {
    return await apiFetch('/api/crash-report', {
      method: 'POST',
      body: JSON.stringify({
        ...report,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      }),
    });
  } catch (err) {
    console.warn('Failed to log crash to backend:', err?.message);
  }
}

// ----------------- Cache Helpers ----------------- //

export function isTabCacheValid(mode) {
  const cache = tabCaches[mode];
  if (!cache || !cache.items || cache.items.length === 0) return false;
  return Date.now() - cache.lastLoadedTime < CACHE_TTL_MS;
}

export function clearTabCache(mode) {
  if (mode && tabCaches[mode]) {
    tabCaches[mode].items = [];
    tabCaches[mode].currentPage = 1;
    tabCaches[mode].hasMorePages = true;
    tabCaches[mode].lastLoadedTime = 0;
  }
}

export function clearAllCaches() {
  Object.keys(tabCaches).forEach(clearTabCache);
  channelCache.clear();
  seriesDetailsCache.clear();
  streamResolutionCache.clear();
}
