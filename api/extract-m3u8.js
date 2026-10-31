import crypto from 'node:crypto';

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
    console.warn('[extract-m3u8] Greenmotors resolution error:', err?.message);
  }
  return null;
}

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
    console.warn('[extract-m3u8] Multicloud resolution error:', err?.message);
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(200).json({ success: false, error: 'Missing "url" parameter' });
  }

  let url = targetUrl.trim();
  if (url.includes('hdstrram4u.com')) {
    url = url.replace('hdstrram4u.com', 'hdstream4u.com');
  }

  if (
    url.includes('.m3u8') ||
    url.includes('action=watch') ||
    url.includes('multidownload') ||
    url.includes('uprising.best') ||
    url.endsWith('.mp4') ||
    url.endsWith('.mkv')
  ) {
    const finalUrl =
      url.includes('uprising.best') && !url.includes('.m3u8')
        ? `${url}${url.includes('?') ? '&' : '?'}ext=.m3u8`
        : url;
    return res.status(200).json({ success: true, m3u8Url: finalUrl });
  }

  if (url.includes('/file/')) {
    url = url.replace('/file/', '/embed/');
  }

  if (url.includes('greenmotors')) {
    const gm = await resolveGreenmotors(url);
    if (gm) return res.status(200).json({ success: true, m3u8Url: gm });
  }

  if (url.includes('multicloudlinks') || url.includes('multidownload')) {
    const mc = await resolveMulticloud(url);
    if (mc) return res.status(200).json({ success: true, m3u8Url: mc });
  }

  if (url.includes('vidaraa.cc') || url.includes('vidaraa.')) {
    const vd = await extractVidaraaM3u8(url);
    if (vd) return res.status(200).json({ success: true, m3u8Url: vd });
  }

  if (
    url.includes('hubstream') ||
    url.includes('/meb/') ||
    url.includes('/unl/') ||
    url.includes('#')
  ) {
    const hs = await extractHubstreamM3u8(url);
    if (hs) return res.status(200).json({ success: true, m3u8Url: hs });
  }

  try {
    let reqReferer = 'https://hdstream4u.com/';
    let reqOrigin = 'https://hdstream4u.com';
    const lower = url.toLowerCase();
    if (lower.includes('play4u') || lower.includes('uprising')) {
      reqReferer = 'https://play4u.org/';
      reqOrigin = 'https://play4u.org';
    } else {
      try {
        const origin = new URL(url).origin;
        reqReferer = `${origin}/`;
        reqOrigin = origin;
      } catch (_) {}
    }

    const upstreamRes = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': reqReferer,
        'Origin': reqOrigin,
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!upstreamRes.ok) {
      return res.status(200).json({ success: false, error: `Upstream returned ${upstreamRes.status}` });
    }
    const html = await upstreamRes.text();

    // 1. window.__PA_PLAY__ (Play4u or clones)
    const paMatch = html.match(/window\.__PA_PLAY__\s*=\s*(\{[\s\S]*?\});/);
    if (paMatch) {
      try {
        const paData = JSON.parse(paMatch[1]);
        const streamUrl = paData?.streams?.[0]?.m3u8_url || paData?.item?.video_url;
        if (streamUrl) {
          const finalUrl = streamUrl.includes('.m3u8')
            ? streamUrl
            : `${streamUrl}${streamUrl.includes('?') ? '&' : '?'}ext=.m3u8`;
          return res.status(200).json({ success: true, m3u8Url: finalUrl });
        }
      } catch {}
    }

    // 2. Play4u / uprising direct range image stream
    const uprisingMatch = html.match(/https?:\/\/[^\s"'<>]+\/range\/[a-zA-Z0-9_-]+\.png[^\s"'<>]*/i);
    if (uprisingMatch) {
      const uUrl = uprisingMatch[0];
      const finalUrl = `${uUrl}${uUrl.includes('?') ? '&' : '?'}ext=.m3u8`;
      return res.status(200).json({ success: true, m3u8Url: finalUrl });
    }

    // 3. streamSrc match
    const streamSrcMatch =
      html.match(/(?:const|var|let)\s+streamSrc\s*=\s*["']([^"']+)["']/i) ||
      html.match(/["'](https?:\/\/[^"']+(?:action=watch|multidownload)[^"']*)["']/i);
    if (streamSrcMatch && streamSrcMatch[1]) {
      return res.status(200).json({ success: true, m3u8Url: streamSrcMatch[1] });
    }

    // 4. Dean Edwards unpacker
    const unpacked = unpackDeanEdwards(html);
    if (unpacked) {
      const m3u8Match = unpacked.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
      if (m3u8Match) {
        return res.status(200).json({ success: true, m3u8Url: m3u8Match[0] });
      }
      const streamMatch = unpacked.match(/\/stream\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
      if (streamMatch) {
        const origin = new URL(url).origin;
        return res.status(200).json({ success: true, m3u8Url: origin + streamMatch[0] });
      }
    }

    // 5. Direct regex in HTML
    const directMatch = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
    if (directMatch) {
      return res.status(200).json({ success: true, m3u8Url: directMatch[0] });
    }

    return res.status(200).json({ success: false, error: 'No M3U8 found in page' });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
}
