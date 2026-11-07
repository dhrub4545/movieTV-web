/**
 * Stream Header Helper for MovieTV Web
 * Exact 1:1 Architectural Parity with Android StreamHeaderHelper.kt
 *
 * Enforces mandatory Referer and Origin headers per stream host.
 * Prevents CDN edge verification failures (e.g. uprising.best returning HTTP 302 redirecting
 * to google.com when passed an hdstream4u or localhost referer, causing HLS manifest parse errors).
 */

export function getHeadersForStream(url, embedUrl = null, extraHeaders = {}) {
  const result = {};
  const cleanUrl = (url || '').trim().toLowerCase();
  const cleanEmbed = (embedUrl || '').trim().toLowerCase();

  const isPlay4uFamily =
    cleanUrl.includes('play4u') ||
    cleanUrl.includes('uprising') ||
    cleanEmbed.includes('play4u') ||
    cleanEmbed.includes('uprising');

  const isPlaydriveFamily =
    cleanUrl.includes('neopulse') ||
    cleanUrl.includes('playdrive') ||
    cleanUrl.includes('furiosamedia') ||
    cleanUrl.includes('gothamnet') ||
    (cleanUrl.includes('/range/') && !isPlay4uFamily) ||
    cleanEmbed.includes('neopulse') ||
    cleanEmbed.includes('playdrive') ||
    cleanEmbed.includes('furiosamedia') ||
    cleanEmbed.includes('gothamnet');

  if (isPlay4uFamily) {
    result['Referer'] = 'https://play4u.org/';
    result['Origin'] = 'https://play4u.org';
  } else if (isPlaydriveFamily) {
    result['Referer'] = 'https://playdrive.vip/';
    result['Origin'] = 'https://playdrive.vip';
  } else if (
    cleanUrl.includes('hubstream') ||
    cleanEmbed.includes('hubstream') ||
    cleanUrl.includes('skyline') ||
    cleanUrl.includes('greenstream') ||
    cleanUrl.includes('vertexgrowthworks') ||
    cleanUrl.includes('summitnetworksolutions') ||
    cleanUrl.includes('94.131.217')
  ) {
    result['Referer'] = 'https://hubstream.art/';
    result['Origin'] = 'https://hubstream.art';
  } else if (
    cleanUrl.includes('vidaraa') ||
    cleanEmbed.includes('vidaraa') ||
    cleanUrl.includes('97bf1.com') ||
    cleanUrl.includes('s1q2105.com')
  ) {
    result['Referer'] = 'https://vidaraa.cc/';
    result['Origin'] = 'https://vidaraa.cc';
  } else if (
    cleanUrl.includes('greenmotors') ||
    cleanEmbed.includes('greenmotors')
  ) {
    result['Referer'] = 'https://greenmotors.cc/homelander/';
    result['Origin'] = 'https://greenmotors.cc';
  } else if (
    cleanUrl.includes('multidownload') ||
    cleanUrl.includes('multicloudlinks') ||
    cleanEmbed.includes('multidownload') ||
    cleanEmbed.includes('multicloudlinks')
  ) {
    result['Referer'] = 'https://new.multicloudlinks.com/';
    result['Origin'] = 'https://new.multicloudlinks.com';
  } else if (
    cleanUrl.includes('hdstream4u') ||
    cleanUrl.includes('acek-cdn') ||
    cleanUrl.includes('dramiyos-cdn') ||
    cleanUrl.includes('vidhide') ||
    cleanUrl.includes('vidhidehub') ||
    cleanUrl.includes('vidhideplus') ||
    cleanUrl.includes('vidhidepre') ||
    cleanEmbed.includes('hdstream4u') ||
    cleanEmbed.includes('vidhide')
  ) {
    result['Referer'] = 'https://hdstream4u.com/';
    result['Origin'] = 'https://hdstream4u.com';
  } else {
    try {
      const parsed = new URL(url || embedUrl || 'https://hdstream4u.com/');
      if (parsed.hostname) {
        result['Referer'] = `${parsed.origin}/`;
        result['Origin'] = parsed.origin;
      } else {
        result['Referer'] = 'https://hdstream4u.com/';
        result['Origin'] = 'https://hdstream4u.com';
      }
    } catch {
      result['Referer'] = 'https://hdstream4u.com/';
      result['Origin'] = 'https://hdstream4u.com';
    }
  }

  // Overlay extraHeaders while guarding against poisoning (e.g., uprising or playdrive with hdstream4u referer)
  if (extraHeaders && typeof extraHeaders === 'object') {
    Object.entries(extraHeaders).forEach(([key, value]) => {
      if (!value || typeof value !== 'string') return;
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'user-agent') return;

      if (lowerKey === 'referer' || lowerKey === 'origin') {
        const valueLower = value.toLowerCase();
        const isBadHdstream = valueLower.includes('hdstream4u');
        if ((isPlay4uFamily || isPlaydriveFamily) && isBadHdstream) {
          // Reject poisoning to prevent 302 redirect loop to google.com
          return;
        }
        if (isPlaydriveFamily && !valueLower.includes('playdrive')) {
          return;
        }
        if (isPlay4uFamily && !valueLower.includes('play4u')) {
          return;
        }
      }
      result[key] = value;
    });
  }

  return result;
}

/**
 * Checks whether a given stream URL requires proxying to bypass CORS
 * or forbidden browser headers (e.g. anti-hotlinking Referer).
 */
export function needsStreamingProxy(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();

  // Already proxied
  if (clean.startsWith('/api/local-proxy') || clean.startsWith('/api/proxy-stream')) {
    return false;
  }

  // Public test streams with open CORS
  if (clean.includes('test-streams.mux.dev') || clean.includes('commondatastorage.googleapis.com')) {
    return false;
  }

  // Relative local paths
  if (clean.startsWith('/') && !clean.startsWith('//')) {
    return false;
  }

  // Force proxy for unencrypted HTTP streams when loaded on HTTPS (prevents Mixed Content block)
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && clean.startsWith('http://')) {
    return true;
  }

  // IPTV streams with direct IP addresses or non-standard ports (no CORS support)
  if (clean.match(/^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/) || clean.match(/^https?:\/\/[^/]+:\d{2,5}\//)) {
    return true;
  }

  // Known open-CORS live broadcast CDNs that play directly without proxy
  if (
    clean.includes('cloudfront.net') ||
    clean.includes('acek-cdn') ||
    clean.includes('dramiyos-cdn') ||
    clean.includes('tangotv.in') ||
    clean.includes('smartplaytv.in') ||
    clean.includes('nellaiiptv.com') ||
    clean.includes('sofast.tv') ||
    clean.includes('rabta.stream') ||
    clean.includes('bozztv.com') ||
    clean.includes('akamaized.net') ||
    clean.includes('amagi.tv') ||
    clean.includes('wurl.tv') ||
    clean.includes('klowdtv.com')
  ) {
    return false;
  }

  // Known protected CDN hosts requiring Referer or CORS headers (movies & series)
  return (
    clean.includes('/range/') ||
    clean.includes('neopulse') ||
    clean.includes('playdrive') ||
    clean.includes('furiosamedia') ||
    clean.includes('gothamnet') ||
    clean.includes('uprising') ||
    clean.includes('play4u') ||
    clean.includes('hdstream4u') ||
    clean.includes('vidhide') ||
    clean.includes('hubstream') ||
    clean.includes('vidaraa') ||
    clean.includes('greenmotors') ||
    clean.includes('multicloudlinks') ||
    clean.includes('multidownload') ||
    clean.includes('skyline') ||
    clean.includes('vertexgrowthworks') ||
    clean.includes('greenstream') ||
    clean.includes('97bf1.com') ||
    clean.includes('s1q2105.com') ||
    clean.includes('94.131.217')
  );
}

/**
 * Builds a proxied stream URL for the browser.
 */
export function buildProxiedStreamUrl(rawUrl, referer = null, origin = null) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();

  if (trimmed.startsWith('/api/local-proxy') || trimmed.startsWith('/api/proxy-stream')) {
    return trimmed;
  }

  const headers = getHeadersForStream(trimmed);
  const targetReferer = referer || headers.Referer || 'https://hdstream4u.com/';
  const targetOrigin = origin || headers.Origin || 'https://hdstream4u.com';

  const params = new URLSearchParams();
  params.set('url', trimmed);
  params.set('referer', targetReferer);
  if (targetOrigin) params.set('origin', targetOrigin);

  return `/api/local-proxy?${params.toString()}`;
}

/**
 * Returns the final URL to be loaded by Hls.js or HTML5 <video>.
 */
export function getPlayableStreamUrl(rawUrl, embedUrl = null, extraHeaders = {}) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();

  if (!needsStreamingProxy(trimmed)) {
    return trimmed;
  }

  const headers = getHeadersForStream(trimmed, embedUrl, extraHeaders);
  return buildProxiedStreamUrl(trimmed, headers.Referer, headers.Origin);
}

