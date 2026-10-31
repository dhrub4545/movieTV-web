/**
 * MovieTV Web HLS Streaming Proxy & Manifest Rewriter
 * Provides exact architectural parity with Android OkHttpDataSource & DisguisedHlsExtractorFactory.
 *
 * 1. Solves Cloudflare edge anti-hotlinking (uprising.best 302 redirecting to google.com).
 * 2. Rewrites .m3u8 manifests so all child playlists, keys, and segments route through proxy.
 * 3. Supports HTTP 206 Partial Content & byte-range requests for smooth seeking.
 * 4. Normalizes disguised TS chunks (.png, .jpg, .css) to video/mp2t.
 * 5. Bypasses CORS restrictions across all upstream CDNs.
 */

function getUpstreamHeaders(url, clientReferer, clientOrigin) {
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

  // Override with clientReferer unless it creates a conflicting poison
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

function rewriteM3u8Manifest(manifestText, baseUrl, referer, origin) {
  const lines = manifestText.split(/\r?\n/);
  const rewrittenLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      rewrittenLines.push(line);
      continue;
    }

    // Rewrite tags containing URI="<url>" (e.g. #EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA)
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

    // Line is an actual stream or segment URL
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Range, Referer, User-Agent'
  );
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = req.query.url;
  const clientReferer = req.query.referer;
  const clientOrigin = req.query.origin;

  if (!targetUrl) {
    return res.status(400).send('Missing "url" parameter');
  }

  const { headers, referer, origin } = getUpstreamHeaders(targetUrl, clientReferer, clientOrigin);

  // Forward Range header if present
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
      const rewritten = rewriteM3u8Manifest(manifestText, finalUrl, referer, origin);
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.statusCode = status === 206 ? 200 : status;
      return res.end(rewritten);
    }

    // Binary segment / Subtitle / Key / Non-manifest media response
    res.statusCode = status;

    const acceptRanges = upstreamRes.headers.get('accept-ranges') || 'bytes';
    res.setHeader('Accept-Ranges', acceptRanges);

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);
    res.setHeader('Content-Length', buffer.length);

    // Exact parity with Android DisguisedHlsExtractorFactory:
    // Determine proper MIME container for the browser MSE demuxer
    const lowerUrl = targetUrl.toLowerCase();
    const isDisguisedChunk =
      lowerUrl.includes('/range/') ||
      lowerUrl.includes('.png') ||
      lowerUrl.includes('.jpg') ||
      lowerUrl.includes('.jpeg') ||
      lowerUrl.includes('.css') ||
      lowerUrl.includes('.js') ||
      lowerUrl.includes('.html');

    // 1. MPEG-TS: starts with 0x47 sync byte OR disguised chunk without fMP4 signatures
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
}
