/**
 * Content Filtering & Formatting Utilities
 * Faithful port of Android MovieTV's filtering and formatting rules.
 */

// Adult keywords blacklist
const ADULT_KEYWORDS = [
  '18+',
  '18 +',
  'adult',
  'erotic',
  'sex',
  'sensual',
  'softcore',
  'hotshots',
  'ullu',
  'kooku',
  'primeshots',
  'voovi',
  'cineprime',
  'moodx',
  'chikooflix',
  'hunters',
  'nuefliks',
  'besharams',
  'atrangii',
];

/**
 * Checks if a title or description matches adult content.
 * Explicitly preserves titles containing "toxic" (e.g. Yash's Toxic).
 */
export function isAdultContent(title = '', overview = '') {
  const text = `${title} ${overview}`.toLowerCase();

  // EXCEPTION: Explicitly preserve "toxic" movie
  if (text.includes('toxic')) {
    return false;
  }

  // Check blacklist
  for (const keyword of ADULT_KEYWORDS) {
    if (text.includes(keyword)) {
      return true;
    }
  }

  // Specific compound check: papa & friend
  if (text.includes('papa') && text.includes('friend')) {
    return true;
  }

  return false;
}

/**
 * Filters a list of media items, removing adult content.
 */
export function filterMediaList(items = []) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => !isAdultContent(item.title, item.overview));
}

/**
 * Determines the display quality tag (HDCAM, 4K, or HD).
 */
export function getDisplayQuality(item) {
  if (!item) return 'HD';
  if (item.quality && typeof item.quality === 'string' && item.quality.trim().length > 0) {
    return item.quality.trim().toUpperCase();
  }

  const text = `${item.title || ''} ${item.overview || ''}`.toLowerCase();

  if (
    text.includes('hdcam') ||
    text.includes('camrip') ||
    text.includes('cam') ||
    text.includes('hdtc') ||
    text.includes('hdts') ||
    text.includes('hq-hdtc') ||
    text.includes('pre-dvd') ||
    text.includes('dvdscr') ||
    text.includes('tc') ||
    text.includes('ts') ||
    text.includes('(line)') ||
    text.includes('line')
  ) {
    return 'HDCAM';
  }

  if (text.includes('4k') || text.includes('2160p') || text.includes('uhd')) {
    return '4K';
  }

  return 'HD';
}

/**
 * Returns Tailwind styling for quality badges.
 * HDCAM -> Orange/Amber
 * 4K    -> Purple/Indigo
 * HD    -> Blue
 */
export function getQualityBadgeClasses(quality) {
  const q = (quality || 'HD').toUpperCase();
  if (q.includes('CAM')) {
    return {
      badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm shadow-amber-500/10',
      dot: 'bg-amber-400',
    };
  }
  if (q.includes('4K') || q.includes('UHD')) {
    return {
      badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/10',
      dot: 'bg-purple-400',
    };
  }
  return {
    badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm shadow-blue-500/10',
    dot: 'bg-blue-400',
  };
}

/**
 * Poster URL optimization:
 * Replaces TMDB /w500/ and /original/ with /w342/ for 50%+ faster loading and low memory usage.
 */
export function getOptimizedPosterUrl(originalUrl) {
  if (!originalUrl || typeof originalUrl !== 'string' || originalUrl.trim().length === 0) {
    return null;
  }
  let url = originalUrl.trim();
  if (url.includes('/w500/')) {
    return url.replace('/w500/', '/w342/');
  }
  if (url.includes('/original/')) {
    return url.replace('/original/', '/w342/');
  }
  return url;
}

/**
 * Helper to identify if an item is a series/tv show.
 */
export function isSeriesItem(item) {
  if (!item) return false;
  return (
    item.type?.toLowerCase() === 'tv' ||
    item.type?.toLowerCase() === 'series' ||
    (Array.isArray(item.seasons) && item.seasons.length > 0) ||
    (typeof item.category === 'string' && item.category.toLowerCase().includes('series'))
  );
}
