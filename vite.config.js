import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import crypto from 'node:crypto';

// Dean Edwards JavaScript unpacker
function unpackDeanEdwards(packed) {
  try {
    const regex = /eval\(function\(p,a,c,k,e,d\)[\s\S]*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
    const match = packed.match(regex);
    if (!match) return '';
    let [_, p, aStr, cStr, kStr] = match;
    let a = parseInt(aStr, 10) || 36;
    let c = parseInt(cStr, 10) || 0;
    const k = kStr.split('|');
    while (c--) {
      if (k[c]) {
        p = p.replace(new RegExp('\\b' + c.toString(a) + '\\b', 'g'), () => k[c]);
      }
    }
    return p;
  } catch {
    return '';
  }
}

// Hubstream live M3U8 extraction
async function extractHubstreamM3u8(url) {
  try {
    let videoId = '';
    const hashMatch = url.match(/#([a-zA-Z0-9_-]+)/);
    if (hashMatch) {
      videoId = hashMatch[1];
    } else {
      const pathMatch = url.match(/\/(?:meb|unl|video|stream)\/([a-zA-Z0-9_-]+)/);
      if (pathMatch) {
        videoId = pathMatch[1];
      } else {
        const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (idMatch) videoId = idMatch[1];
      }
    }
    if (!videoId) return null;

    const apiUrl = `https://hubstream.art/api/v1/video?id=${videoId}&w=1920&h=1080`;
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Referer': 'https://hubstream.art/',
      },
    });
    if (!res.ok) return null;
    const hexCipher = (await res.text()).trim();
    if (hexCipher.length < 32) return null;

    const key = Buffer.from('kiemtienmua911ca', 'utf8');
    const iv = Buffer.from('1234567890oiuytr', 'utf8');
    const cipherBytes = Buffer.from(hexCipher, 'hex');

    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    decipher.setAutoPadding(true);
    const decrypted = Buffer.concat([decipher.update(cipherBytes), decipher.final()]);
    const json = JSON.parse(decrypted.toString('utf8'));
    return json.cfNative || json.source || null;
  } catch {
    return null;
  }
}

// Vidaraa live M3U8 extraction
async function extractVidaraaM3u8(url) {
  try {
    let filecode = '';
    const match = url.match(/\/(?:e|v)\/([a-zA-Z0-9_-]+)/);
    if (match) filecode = match[1];
    if (!filecode) {
      const parts = url.split('/');
      filecode = parts[parts.length - 1].split('?')[0];
    }
    if (!filecode || filecode.length < 3) return null;

    const res = await fetch('https://vidaraa.cc/api/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': `https://vidaraa.cc/e/${filecode}`,
        'Origin': 'https://vidaraa.cc',
      },
      body: JSON.stringify({
        filecode,
        device: 'desktop',
        codecs: { h264: true, aac: true },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.streaming_url || null;
  } catch {
    return null;
  }
}

function rot13(str) {
  return str.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

function decodeBase64(str) {
  try {
    return Buffer.from(str.trim(), 'base64').toString('utf8');
  } catch {
    return '';
  }
}

// Greenmotors stream resolution (exact parity with Player1Activity.kt)
async function resolveGreenmotors(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const match = html.match(/s\('o',\s*'([^']+)'\)/);
    if (!match) return null;
    const b64 = match[1];

    const d1 = decodeBase64(b64);
    const d2 = decodeBase64(d1);
    const d3 = rot13(d2);
    const d4 = decodeBase64(d3);
    if (!d4) return null;

    const json = JSON.parse(d4);
    const encodedO = json.o;
    if (!encodedO) return null;

    const playerEmbedUrl = decodeBase64(encodedO);
    if (!playerEmbedUrl || !playerEmbedUrl.startsWith('http')) return null;

    const playerResp = await fetch(playerEmbedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://greenmotors.cc/homelander/',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!playerResp.ok) return null;
    const playerHtml = await playerResp.text();

    const sMatch = playerHtml.match(/const\s+streamSrc\s*=\s*"([^"]+)"/);
    if (sMatch && sMatch[1]) return sMatch[1];

    const m3u8Match = playerHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
    if (m3u8Match) return m3u8Match[0];
  } catch (err) {
    console.warn('[Vite Extractor] Greenmotors resolution error:', err?.message);
  }
  return null;
}

// Multicloud stream resolution
async function resolveMulticloud(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://new.multicloudlinks.com/',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const regex = /(?:const|var|let)\s+streamSrc\s*=\s*["']([^"']+)["']/i;
    const match = html.match(regex);
    if (match && match[1]) return match[1];

    const m3u8Match = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
    if (m3u8Match) return m3u8Match[0];
  } catch (err) {
    console.warn('[Vite Extractor] Multicloud resolution error:', err?.message);
  }
  return null;
}

// Universal direct M3U8 extractor (matches Android Player1Activity & Player2Activity)
async function extractDirectM3u8(url) {
  if (!url || typeof url !== 'string') return null;
  let targetUrl = url.trim();

  if (targetUrl.includes('hdstrram4u.com')) {
    targetUrl = targetUrl.replace('hdstrram4u.com', 'hdstream4u.com');
  }

  // Already a direct stream
  if (
    targetUrl.includes('.m3u8') ||
    targetUrl.includes('action=watch') ||
    targetUrl.includes('multidownload') ||
    targetUrl.includes('uprising.best') ||
    targetUrl.endsWith('.mp4') ||
    targetUrl.endsWith('.mkv')
  ) {
    return targetUrl.includes('uprising.best') && !targetUrl.includes('.m3u8')
      ? `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}ext=.m3u8`
      : targetUrl;
  }

  if (targetUrl.includes('/file/')) {
    targetUrl = targetUrl.replace('/file/', '/embed/');
  }

  // 1. Greenmotors
  if (targetUrl.includes('greenmotors')) {
    const gm = await resolveGreenmotors(targetUrl);
    if (gm) return gm;
  }

  // 2. Multicloud
  if (targetUrl.includes('multicloudlinks') || targetUrl.includes('multidownload')) {
    const mc = await resolveMulticloud(targetUrl);
    if (mc) return mc;
  }

  // 3. Vidaraa
  if (targetUrl.includes('vidaraa.cc') || targetUrl.includes('vidaraa.')) {
    const vd = await extractVidaraaM3u8(targetUrl);
    if (vd) return vd;
  }

  // 4. Hubstream
  if (
    targetUrl.includes('hubstream') ||
    targetUrl.includes('/meb/') ||
    targetUrl.includes('/unl/') ||
    targetUrl.includes('#')
  ) {
    const hs = await extractHubstreamM3u8(targetUrl);
    if (hs) return hs;
  }

  // 5. HDStream4u / Play4u / General Embed Page
  try {
    let reqReferer = 'https://hdstream4u.com/';
    let reqOrigin = 'https://hdstream4u.com';
    const lower = targetUrl.toLowerCase();
    if (lower.includes('play4u') || lower.includes('uprising')) {
      reqReferer = 'https://play4u.org/';
      reqOrigin = 'https://play4u.org';
    } else {
      try {
        const origin = new URL(targetUrl).origin;
        reqReferer = `${origin}/`;
        reqOrigin = origin;
      } catch (_) {}
    }

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': reqReferer,
        'Origin': reqOrigin,
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (!html) return null;

    // 0. window.__PA_PLAY__ (Play4u or clones)
    const paMatch = html.match(/window\.__PA_PLAY__\s*=\s*(\{[\s\S]*?\});/);
    if (paMatch) {
      try {
        const paData = JSON.parse(paMatch[1]);
        const streamUrl = paData?.streams?.[0]?.m3u8_url || paData?.item?.video_url;
        if (streamUrl) {
          return streamUrl.includes('.m3u8')
            ? streamUrl
            : `${streamUrl}${streamUrl.includes('?') ? '&' : '?'}ext=.m3u8`;
        }
      } catch {}
    }

    // 0b. Play4u / uprising direct range image stream
    const uprisingMatch = html.match(/https?:\/\/[^\s"'<>]+\/range\/[a-zA-Z0-9_-]+\.png[^\s"'<>]*/i);
    if (uprisingMatch) {
      const uUrl = uprisingMatch[0];
      return `${uUrl}${uUrl.includes('?') ? '&' : '?'}ext=.m3u8`;
    }

    // 1. streamSrc match
    const streamSrcMatch =
      html.match(/(?:const|var|let)\s+streamSrc\s*=\s*["']([^"']+)["']/i) ||
      html.match(/["'](https?:\/\/[^"']+(?:action=watch|multidownload)[^"']*)["']/i);
    if (streamSrcMatch && streamSrcMatch[1]) {
      return streamSrcMatch[1];
    }

    // 2. Dean Edwards unpacker
    const unpacked = unpackDeanEdwards(html);
    if (unpacked) {
      const m3u8Match = unpacked.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
      if (m3u8Match) {
        return m3u8Match[0];
      }
      const streamMatch = unpacked.match(/\/stream\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
      if (streamMatch) {
        const origin = new URL(targetUrl).origin;
        return origin + streamMatch[0];
      }
    }

    // 3. Direct regex in HTML
    const directMatch = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
    if (directMatch) {
      return directMatch[0];
    }
  } catch (err) {
    console.warn('[Vite Extractor] Fetch error for:', targetUrl, err?.message);
  }

  return null;
}

// Proxy upstream header helper
function getProxyHeaders(url, clientReferer, clientOrigin) {
  const cleanUrl = (url || '').trim().toLowerCase();
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Encoding': 'identity',
  };

  let computedReferer = '';
  let computedOrigin = '';

  if (cleanUrl.includes('play4u') || cleanUrl.includes('uprising')) {
    computedReferer = 'https://play4u.org/';
    computedOrigin = 'https://play4u.org';
  } else if (
    cleanUrl.includes('hubstream') ||
    cleanUrl.includes('skyline') ||
    cleanUrl.includes('greenstream') ||
    cleanUrl.includes('vertexgrowthworks') ||
    cleanUrl.includes('summitnetworksolutions') ||
    cleanUrl.includes('94.131.217')
  ) {
    computedReferer = 'https://hubstream.art/';
    computedOrigin = 'https://hubstream.art';
  } else if (
    cleanUrl.includes('vidaraa') ||
    cleanUrl.includes('97bf1.com') ||
    cleanUrl.includes('s1q2105.com')
  ) {
    computedReferer = 'https://vidaraa.cc/';
    computedOrigin = 'https://vidaraa.cc';
  } else if (cleanUrl.includes('greenmotors')) {
    computedReferer = 'https://greenmotors.cc/homelander/';
    computedOrigin = 'https://greenmotors.cc';
  } else if (cleanUrl.includes('multidownload') || cleanUrl.includes('multicloudlinks')) {
    computedReferer = 'https://new.multicloudlinks.com/';
    computedOrigin = 'https://new.multicloudlinks.com';
  } else if (
    cleanUrl.includes('hdstream4u') ||
    cleanUrl.includes('acek-cdn') ||
    cleanUrl.includes('dramiyos-cdn')
  ) {
    computedReferer = 'https://hdstream4u.com/';
    computedOrigin = 'https://hdstream4u.com';
  } else {
    try {
      const parsed = new URL(url);
      computedReferer = `${parsed.origin}/`;
      computedOrigin = parsed.origin;
    } catch {
      computedReferer = 'https://hdstream4u.com/';
      computedOrigin = 'https://hdstream4u.com';
    }
  }

  if (clientReferer && typeof clientReferer === 'string' && clientReferer.trim()) {
    const isUprising = cleanUrl.includes('uprising') || cleanUrl.includes('play4u');
    const isBadHdstream = clientReferer.toLowerCase().includes('hdstream4u');
    if (!(isUprising && isBadHdstream)) {
      computedReferer = clientReferer.trim();
    }
  }

  if (clientOrigin && typeof clientOrigin === 'string' && clientOrigin.trim()) {
    const isUprising = cleanUrl.includes('uprising') || cleanUrl.includes('play4u');
    const isBadHdstream = clientOrigin.toLowerCase().includes('hdstream4u');
    if (!(isUprising && isBadHdstream)) {
      computedOrigin = clientOrigin.trim();
    }
  }

  headers['Referer'] = computedReferer;
  headers['Origin'] = computedOrigin;

  return { headers, referer: computedReferer, origin: computedOrigin };
}

// Rewrites M3U8 lines to route all sub-playlists, keys, and segments through /api/local-proxy
function rewriteM3u8(manifestText, baseUrl, referer, origin) {
  const lines = manifestText.split(/\r?\n/);
  const rewrittenLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      rewrittenLines.push(line);
      continue;
    }

    if (trimmed.startsWith('#')) {
      const uriAttrRegex = /URI="([^"]+)"/g;
      const modifiedLine = line.replace(uriAttrRegex, (match, pUri) => {
        try {
          const resolved = new URL(pUri, baseUrl).href;
          const proxied = `/api/local-proxy?url=${encodeURIComponent(resolved)}&referer=${encodeURIComponent(
            referer
          )}&origin=${encodeURIComponent(origin)}`;
          return `URI="${proxied}"`;
        } catch {
          return match;
        }
      });
      rewrittenLines.push(modifiedLine);
      continue;
    }

    try {
      const resolved = new URL(trimmed, baseUrl).href;
      const proxied = `/api/local-proxy?url=${encodeURIComponent(resolved)}&referer=${encodeURIComponent(
        referer
      )}&origin=${encodeURIComponent(origin)}`;
      rewrittenLines.push(proxied);
    } catch {
      rewrittenLines.push(line);
    }
  }

  return rewrittenLines.join('\n');
}

// Vite plugin to provide /api/extract-m3u8 and local streaming proxy
function m3u8ExtractorPlugin() {
  return {
    name: 'm3u8-extractor-plugin',
    configureServer(server) {
      // 1. /api/extract-m3u8 handler
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/extract-m3u8')) {
          return next();
        }

        const reqUrl = new URL(req.url, 'http://localhost:5173');
        const targetUrl = reqUrl.searchParams.get('url');

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          return res.end();
        }

        if (!targetUrl) {
          res.statusCode = 200;
          return res.end(JSON.stringify({ success: false, error: 'Missing "url" parameter' }));
        }

        try {
          console.log(`[Vite Extractor] Extracting direct M3U8 from: ${targetUrl}`);
          const m3u8Url = await extractDirectM3u8(targetUrl);
          if (m3u8Url) {
            console.log(`[Vite Extractor] Successfully extracted M3U8: ${m3u8Url}`);
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, m3u8Url }));
          } else {
            console.warn(`[Vite Extractor] Could not extract M3U8 for: ${targetUrl}`);
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: false, error: 'Could not extract M3U8 link' }));
          }
        } catch (err) {
          console.error('[Vite Extractor] Extraction exception:', err);
          res.statusCode = 200;
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      // 2. Local streaming proxy & manifest rewriter (/api/local-proxy)
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/local-proxy')) {
          return next();
        }

        const reqUrl = new URL(req.url, 'http://localhost:5173');
        const targetUrl = reqUrl.searchParams.get('url');
        const clientReferer = reqUrl.searchParams.get('referer');
        const clientOrigin = reqUrl.searchParams.get('origin');

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Origin, X-Requested-With, Content-Type, Accept, Range, Referer, User-Agent'
        );
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          return res.end();
        }

        if (!targetUrl) {
          res.statusCode = 400;
          return res.end('Missing "url" parameter');
        }

        const { headers, referer, origin } = getProxyHeaders(targetUrl, clientReferer, clientOrigin);

        if (req.headers.range) {
          headers['Range'] = req.headers.range;
        }

        try {
          const upstreamRes = await fetch(targetUrl, {
            method: req.method === 'HEAD' ? 'HEAD' : 'GET',
            headers,
            redirect: 'follow',
            signal: AbortSignal.timeout(25000),
          });

          const status = upstreamRes.status;
          const finalUrl = upstreamRes.url || targetUrl;
          const contentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();

          // Forward HTTP error status codes immediately so client/HLS.js can handle properly
          if (status >= 400) {
            res.statusCode = status;
            const errText = await upstreamRes.text();
            return res.end(errText);
          }

          if (req.method === 'HEAD') {
            res.statusCode = status;
            if (contentType) res.setHeader('Content-Type', contentType);
            return res.end();
          }

          const arrayBuf = await upstreamRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);

          // Dynamic Manifest Sniffing: Check if the response contains HLS manifest headers
          // Handles CDNs that disguise playlists with .png, .jpg, .css, or .html extensions
          const peekHead = buffer.slice(0, 512).toString('utf8');
          const isManifest =
            peekHead.includes('#EXTM3U') ||
            peekHead.includes('#EXT-X-') ||
            targetUrl.includes('.m3u8') ||
            finalUrl.includes('.m3u8') ||
            contentType.includes('mpegurl') ||
            contentType.includes('application/x-mpegurl') ||
            contentType.includes('application/vnd.apple.mpegurl');

          if (isManifest && (peekHead.includes('#EXTM3U') || peekHead.includes('#EXT-X-'))) {
            const manifestText = buffer.toString('utf8');
            const rewritten = rewriteM3u8(manifestText, finalUrl, referer, origin);
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.statusCode = status === 206 ? 200 : status;
            return res.end(rewritten);
          }

          // Segments / Video data / Subtitles
          res.statusCode = status;

          const acceptRanges = upstreamRes.headers.get('accept-ranges') || 'bytes';
          res.setHeader('Accept-Ranges', acceptRanges);

          const contentRange = upstreamRes.headers.get('content-range');
          if (contentRange) res.setHeader('Content-Range', contentRange);
          res.setHeader('Content-Length', buffer.length);

          const lowerUrl = targetUrl.toLowerCase();
          const isDisguisedChunk =
            lowerUrl.includes('/range/') ||
            lowerUrl.includes('.png') ||
            lowerUrl.includes('.jpg') ||
            lowerUrl.includes('.jpeg') ||
            lowerUrl.includes('.css') ||
            lowerUrl.includes('.js') ||
            lowerUrl.includes('.html');

          const isTsPacket = buffer.length > 0 && buffer[0] === 0x47;
          const isFmp4 =
            buffer.length >= 8 &&
            (peekHead.includes('ftyp') || peekHead.includes('moof') || peekHead.includes('styp'));

          if (isTsPacket || (isDisguisedChunk && !isFmp4)) {
            res.setHeader('Content-Type', 'video/mp2t');
          } else if (isFmp4) {
            res.setHeader('Content-Type', 'video/mp4');
          } else if (peekHead.startsWith('WEBVTT') || lowerUrl.includes('.vtt')) {
            res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
          } else if (contentType) {
            res.setHeader('Content-Type', contentType);
          }

          return res.end(buffer);
        } catch (err) {
          if (!res.headersSent) {
            res.statusCode = 502;
            return res.end(JSON.stringify({ error: err.message }));
          }
          return res.end();
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget = env.VITE_API_URL || env.VITE_BACKEND_URL || '';

  const server = {
    port: 5173,
    host: true,
  };

  if (backendTarget) {
    server.proxy = {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
    };
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      m3u8ExtractorPlugin(),
    ],
    server,
  };
});
