export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = req.query.url;
  const referer = req.query.referer;

  if (!targetUrl) {
    return res.status(400).send('Missing "url" parameter');
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
    res.status(502).json({ error: err.message });
  }
}

