const PIXEL_ID = '2343390405794612';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!accessToken) {
    res.status(500).json({ error: 'missing META_CAPI_ACCESS_TOKEN env var' });
    return;
  }

  const body = req.body || {};
  const { event_name, event_id, event_source_url, fbp, fbc } = body;

  if (!event_name || !event_id) {
    res.status(400).json({ error: 'event_name and event_id are required' });
    return;
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  const clientIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : (forwardedFor || '').split(',')[0].trim() || req.socket?.remoteAddress;

  const payload = {
    data: [
      {
        event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id,
        event_source_url,
        action_source: 'website',
        user_data: {
          client_ip_address: clientIp,
          client_user_agent: req.headers['user-agent'],
          ...(fbp ? { fbp } : {}),
          ...(fbc ? { fbc } : {}),
        },
      },
    ],
  };

  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    const metaJson = await metaRes.json();
    res.status(metaRes.ok ? 200 : 502).json(metaJson);
  } catch (err) {
    res.status(502).json({ error: 'failed to reach Meta', detail: String(err) });
  }
};
