/**
 * Stream Extraction, Decryption, & Validation Utilities
 * Exact Parity with Android Kotlin Player1Activity & Player2Activity
 */

import {
  getHeadersForStream,
  needsStreamingProxy,
  buildProxiedStreamUrl,
  getPlayableStreamUrl,
} from './streamHeaderHelper';

export {
  getHeadersForStream,
  needsStreamingProxy,
  buildProxiedStreamUrl,
  getPlayableStreamUrl,
};

/**
 * Checks whether a URL is an M3U8 HLS stream.
 * Exact Parity with Android Kotlin Player1Activity & Player2Activity isM3u8Stream.
 */
export function isM3u8Stream(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  return clean.includes('.m3u8') || clean.includes('ext=.m3u8');
}

/**
 * Checks whether a URL is already a direct playable media stream (.m3u8, .mp4, .mkv, action=watch, multidownload).
 * Exact Parity with Android Kotlin Player1Activity & Player2Activity isDirectStream.
 */
export function isDirectStream(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  return (
    isM3u8Stream(clean) ||
    clean.includes('action=watch') ||
    clean.includes('multidownload') ||
    clean.includes('uprising.best') ||
    clean.endsWith('.mp4') ||
    clean.endsWith('.mkv')
  );
}

/**
 * Checks whether an M3U8 URL token is expired or close to expiring (< 2-3 mins).
 * Matches Android Player1Activity & Player2Activity isM3u8TokenExpired exactly.
 */
export function isM3u8TokenExpired(url) {
  if (!url || typeof url !== 'string' || url.trim().length === 0) return true;
  if (url.includes('asn=14618') || url.includes('&asn=&') || url.endsWith('&asn=')) return true;
  const nowSec = Math.floor(Date.now() / 1000);

  // 1. HDStream4u acek-cdn / dramiyos-cdn: s=<start_sec>&e=<duration_sec>
  const matchS = url.match(/[?&]s=(\d+)/);
  const matchE = url.match(/[?&]e=(\d+)/);
  if (matchS && matchE) {
    const s = parseInt(matchS[1], 10) || 0;
    const e = parseInt(matchE[1], 10) || 0;
    return s + e <= nowSec + 180;
  }

  // 2. Hubstream: kx=<timestamp>
  const matchKx = url.match(/[?&]kx=(\d+)/);
  if (matchKx) {
    const kx = parseInt(matchKx[1], 10) || 0;
    return kx <= nowSec + 120;
  }

  // 3. Multidownload / Multicloudlinks: exp=<timestamp>
  const matchExp = url.match(/[?&]exp=(\d+)/);
  if (matchExp) {
    const exp = parseInt(matchExp[1], 10) || 0;
    return exp <= nowSec + 120;
  }

  // 4. Vidaraa: token=...-<timestamp>-...
  const matchVidaraa = url.match(/[?&]token=[a-f0-9]+-(\d+)-/i);
  if (matchVidaraa) {
    const exp = parseInt(matchVidaraa[1], 10) || 0;
    return exp <= nowSec + 120;
  }

  return false;
}

/**
 * Helper to convert a Hex string to Uint8Array.
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Decrypts Hubstream AES-CBC payload in modern browsers via standard Web Crypto API.
 * Key: "kiemtienmua911ca"
 * IV:  "1234567890oiuytr"
 */
export async function decryptHubstreamHex(hexCipher) {
  if (!hexCipher || typeof hexCipher !== 'string' || hexCipher.length < 32) {
    return null;
  }

  try {
    const keyBytes = new TextEncoder().encode('kiemtienmua911ca');
    const ivBytes = new TextEncoder().encode('1234567890oiuytr');

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    );

    const cipherBytes = hexToBytes(hexCipher.trim());
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: ivBytes },
      cryptoKey,
      cipherBytes
    );

    const decryptedText = new TextDecoder().decode(decryptedBuffer);
    const parsed = JSON.parse(decryptedText);

    let m3u8Url = parsed.cfNative || parsed.source || parsed.url;
    if (m3u8Url && m3u8Url.includes('.m3u8')) {
      return m3u8Url;
    }
  } catch (err) {
    console.warn('Hubstream Web Crypto decryption error:', err?.message);
  }
  return null;
}

/**
 * Resolves a direct, fresh .m3u8 stream from an embed URL or expired direct stream link.
 * Exactly matches resolveDirectStreamUrl in Kotlin Player1Activity & Player2Activity.
 */
export async function resolveDirectM3u8(url, fallbackEmbedUrl = '') {
  let target = (url || '').trim();

  // If initial URL is blank or is just a hash/placeholder, fall back to watch embed
  if ((!target || target === '#') && fallbackEmbedUrl) {
    target = fallbackEmbedUrl.trim();
  }
  if (!target || target === '#') return null;

  // If already a valid direct stream with active token, use it immediately
  if (isDirectStream(target) && !isM3u8TokenExpired(target)) {
    return target;
  }

  // If direct stream has expired token and fallback embed URL is available, prefer extracting from embed
  if (isDirectStream(target) && isM3u8TokenExpired(target) && fallbackEmbedUrl && !isDirectStream(fallbackEmbedUrl)) {
    target = fallbackEmbedUrl.trim();
  }

  // 1. Try local/Vite extractor endpoint (/api/extract-m3u8)
  try {
    const res = await fetch(`/api/extract-m3u8?url=${encodeURIComponent(target)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.m3u8Url) {
        return data.m3u8Url;
      }
    }
  } catch (err) {
    console.warn('[streamExtractor] /api/extract-m3u8 call error:', err?.message);
  }

  // 2. Hubstream client-side Web Crypto fallback
  if (target.includes('hubstream') && target.includes('#')) {
    try {
      const videoId = target.split('#')[1]?.split('?')[0];
      if (videoId && videoId.length >= 3) {
        const hsRes = await fetch(`https://hubstream.art/api/v1/video?id=${videoId}&w=1920&h=1080`);
        if (hsRes.ok) {
          const hex = (await hsRes.text()).trim();
          const decrypted = await decryptHubstreamHex(hex);
          if (decrypted) return decrypted;
        }
      }
    } catch (_) {}
  }

  // 3. Fallback: If target was already a direct stream (even if expired check warned), return it as last direct resort
  if (isDirectStream(target)) {
    return target;
  }

  return null;
}

/**
 * Categorizes and prepares streaming options matching Server 1, Server 2, and Server 3.
 */
export function categorizeStreams(resolvedData, mediaItem = {}, episodeContext = null) {
  const sources = [];
  const returnedSources = (resolvedData?.sources || []).filter(
    (s) => s?.url && !s.url.includes('/file/')
  );

  const ep = episodeContext?.episode || {};
  const streamsObj = mediaItem?.streams || {};
  const watchEmbed = (
    resolvedData?.watchEmbedUrl ||
    ep.watch_1_embed ||
    ep.watch1Embed ||
    ep.watch_1_raw ||
    streamsObj.watch_embed ||
    mediaItem?.watch_embed ||
    mediaItem?.watchEmbedUrl ||
    mediaItem?.streamUrl ||
    ''
  ).trim();

  const player2Link = (
    resolvedData?.player2M3u8Url ||
    resolvedData?.player2Url ||
    ep.player_2_m3u8_url ||
    ep.player2M3u8Url ||
    ep.watch_2 ||
    ep.watch2 ||
    streamsObj.player_2 ||
    mediaItem?.player_2 ||
    mediaItem?.player_2_m3u8_url ||
    ''
  ).trim();

  const server1StoredM3u8 = (
    resolvedData?.m3u8Url ||
    ep.m3u8_url ||
    ep.m3u8Url ||
    streamsObj.m3u8_url ||
    mediaItem?.m3u8_url ||
    mediaItem?.m3u8Url ||
    ''
  ).trim();

  if (returnedSources.length > 0) {
    for (const src of returnedSources) {
      const q = (src.quality || '').toLowerCase();
      const isPlayer1 = q.includes('server 1') || q.includes('primary') || q.includes('direct');
      const isPlayer2 = !isPlayer1 && (
        q.includes('server 2') ||
        q.includes('player 2') ||
        q.includes('alternate') ||
        src.url.includes('#') ||
        src.url.includes('/meb/') ||
        src.url.includes('hubstream')
      );

      const pType = isPlayer1 ? 1 : isPlayer2 ? 2 : 3;
      const defaultHeaders = getHeadersForStream(src.url, watchEmbed, src.headers);

      sources.push({
        id: src.id || `server-${pType}-${Math.random().toString(36).substring(2, 7)}`,
        quality: src.quality || (pType === 1 ? '1080p Full HD' : pType === 2 ? 'Adaptive Live HD' : 'Web Stream'),
        url: src.url,
        format: src.format || (src.url.includes('.m3u8') ? 'hls' : 'embed'),
        headers: defaultHeaders,
        playerType: pType,
        watchEmbedUrl: watchEmbed,
        player2Url: player2Link,
        m3u8Url: server1StoredM3u8 || (isPlayer1 ? src.url : ''),
        title: pType === 1
          ? '🎬 Server 1: Primary Stream (Direct HLS)'
          : pType === 2
          ? '🍿 Server 2: Alternate Player (Live HLS)'
          : '🌐 Server 3: Web Stream (Watch Embed)',
        description: pType === 1
          ? 'Fastest direct HLS playback with 200% audio boost & zero ads'
          : pType === 2
          ? 'Live stream with alternate CDN fallback'
          : 'Original web player with Brave Shield popup blocker',
      });
    }
  }

  // Ensure all 3 servers are represented
  const hasP1 = sources.some((s) => s.playerType === 1);
  const hasP2 = sources.some((s) => s.playerType === 2);
  const hasP3 = sources.some((s) => s.playerType === 3);

  // Synthesize Server 1 if missing
  const s1Candidate = server1StoredM3u8 || watchEmbed;
  if (!hasP1 && s1Candidate && !s1Candidate.includes('/file/')) {
    sources.unshift({
      id: 's1-synthesized',
      quality: '1080p Full HD',
      url: s1Candidate,
      format: s1Candidate.includes('.m3u8') ? 'hls' : 'embed',
      headers: getHeadersForStream(s1Candidate, watchEmbed),
      playerType: 1,
      watchEmbedUrl: watchEmbed,
      player2Url: player2Link,
      m3u8Url: server1StoredM3u8,
      title: '🎬 Server 1: Primary Stream (Direct HLS)',
      description: 'Primary instant HLS stream with zero ads',
    });
  }

  // Synthesize Server 2 if missing
  if (!hasP2 && player2Link && !player2Link.includes('/file/')) {
    sources.push({
      id: 's2-synthesized',
      quality: 'Adaptive HD',
      url: player2Link,
      format: player2Link.includes('.m3u8') ? 'hls' : 'embed',
      headers: getHeadersForStream(player2Link, watchEmbed),
      playerType: 2,
      watchEmbedUrl: watchEmbed,
      player2Url: player2Link,
      m3u8Url: server1StoredM3u8,
      title: '🍿 Server 2: Alternate Player (Live HLS)',
      description: 'Alternate live CDN with adaptive multi-bitrate',
    });
  }

  // Synthesize Server 3 if missing
  if (!hasP3 && watchEmbed && !watchEmbed.includes('/file/')) {
    sources.push({
      id: 's3-synthesized',
      quality: 'Web Stream',
      url: watchEmbed,
      format: 'embed',
      headers: getHeadersForStream(watchEmbed),
      playerType: 3,
      watchEmbedUrl: watchEmbed,
      player2Url: player2Link,
      m3u8Url: server1StoredM3u8,
      title: '🌐 Server 3: Web Stream (Watch Embed)',
      description: 'Original web player with Brave Shield popup blocker',
    });
  }

  const s1Found = sources.find((s) => s.playerType === 1);
  const s2Found = sources.find((s) => s.playerType === 2);
  const s3Found = sources.find((s) => s.playerType === 3);

  return {
    sources,
    subtitles: resolvedData?.subtitles || [],
    title: resolvedData?.title || mediaItem?.title || 'MovieTV Stream',
    m3u8Url: s1Found?.url || server1StoredM3u8 || '',
    player2Url: s2Found?.url || player2Link || '',
    watchEmbedUrl: s3Found?.url || watchEmbed || '',
  };
}
