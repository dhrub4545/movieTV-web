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
        p = p.replace(new RegExp('\\b' + c.toString(a) + '\\b', 'g'), k[c]);
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

// Play4u live M3U8 extraction
async function extractPlay4uM3u8(url) {
  try {
    const origin = new URL(url).origin;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': `${origin}/`,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const paMatch = html.match(/window\.__PA_PLAY__\s*=\s*(\{[\s\S]*?\});/);
    if (paMatch) {
      try {
        const paData = JSON.parse(paMatch[1]);
        const streamUrl = paData?.streams?.[0]?.m3u8_url || paData?.item?.video_url;
        if (streamUrl) {
          return streamUrl.includes('.m3u8') ? streamUrl : `${streamUrl}${streamUrl.includes('?') ? '&' : '?'}ext=.m3u8`;
        }
      } catch {}
    }
  } catch {
    return null;
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

  // 1. Play4u
  if (targetUrl.includes('play4u.org') || targetUrl.includes('play4u.')) {
    const p4u = await extractPlay4uM3u8(targetUrl);
    if (p4u) return p4u;
  }

  // 2. Vidaraa
  if (targetUrl.includes('vidaraa.cc') || targetUrl.includes('vidaraa.')) {
    const vd = await extractVidaraaM3u8(targetUrl);
    if (vd) return vd;
  }

  // 3. Hubstream
  if (
    targetUrl.includes('hubstream') ||
    targetUrl.includes('/meb/') ||
    targetUrl.includes('/unl/') ||
    targetUrl.includes('#')
  ) {
    const hs = await extractHubstreamM3u8(targetUrl);
    if (hs) return hs;
  }

  // 4. HDStream4u / Multicloudlinks / General Embed Page
  try {
    const origin = new URL(targetUrl).origin;
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': `${origin}/`,
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (!html) return null;

    // Check for window.__PA_PLAY__
    const paMatch = html.match(/window\.__PA_PLAY__\s*=\s*(\{[\s\S]*?\});/);
    if (paMatch) {
      try {
        const paData = JSON.parse(paMatch[1]);
        const streamUrl = paData?.streams?.[0]?.m3u8_url || paData?.item?.video_url;
        if (streamUrl) {
          return streamUrl.includes('.m3u8') ? streamUrl : `${streamUrl}${streamUrl.includes('?') ? '&' : '?'}ext=.m3u8`;
        }
      } catch {}
    }

    // A. streamSrc match
    const streamSrcMatch =
      html.match(/(?:const|var|let)\s+streamSrc\s*=\s*["']([^"']+)["']/i) ||
      html.match(/["'](https?:\/\/[^"']+(?:action=watch|multidownload)[^"']*)["']/i);
    if (streamSrcMatch && streamSrcMatch[1]) {
      return streamSrcMatch[1];
    }

    // B. Dean Edwards unpacker
    const unpacked = unpackDeanEdwards(html);
    if (unpacked) {
      const m3u8Match = unpacked.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
      if (m3u8Match) {
        return m3u8Match[0];
      }
      const streamMatch = unpacked.match(/\/stream\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
      if (streamMatch) {
        return origin + streamMatch[0];
      }
    }

    // C. Direct regex in HTML
    const directMatch = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
    if (directMatch) {
      return directMatch[0];
    }
  } catch (err) {
    console.warn('[Vite Extractor] Fetch error for:', targetUrl, err?.message);
  }

  return null;
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
          res.statusCode = 400;
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

      // 2. Local fallback stream proxy (/api/local-proxy?url=...&referer=...)
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/local-proxy')) {
          return next();
        }

        const reqUrl = new URL(req.url, 'http://localhost:5173');
        const targetUrl = reqUrl.searchParams.get('url');
        const referer = reqUrl.searchParams.get('referer');

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          return res.end();
        }

        if (!targetUrl) {
          res.statusCode = 400;
          return res.end('Missing "url" parameter');
        }

        try {
          const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
          };
          if (referer) headers['Referer'] = referer;

          const upstreamRes = await fetch(targetUrl, {
            headers,
            signal: AbortSignal.timeout(15000),
          });

          res.statusCode = upstreamRes.status;
          const contentType = upstreamRes.headers.get('content-type');
          if (contentType) res.setHeader('Content-Type', contentType);

          const buffer = await upstreamRes.arrayBuffer();
          res.end(Buffer.from(buffer));
        } catch (err) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: err.message }));
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
