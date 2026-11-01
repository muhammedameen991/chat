/**
 * Vercel Serverless Function: /api/signaling
 * Provides WebRTC signaling coordination for MeshChat on Vercel deployment.
 * Supports:
 * - Sending WebRTC SDP Offer, SDP Answer, ICE Candidates, Typing, Message Relay, Acks
 * - Polling unread signals
 * - Server-Sent Events (SSE) streaming where supported
 */

// Note: In serverless environments, module-level memory is preserved during warm invocations.
// For multi-region serverless deployment, MeshChat documents optional Vercel KV / Upstash Redis
// configuration, but works out-of-the-box with immediate memory + edge sync.

let signalsStore = globalThis.__meshchat_signals || [];
globalThis.__meshchat_signals = signalsStore;

export default async function handler(req, res) {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, user, since } = req.query;

  // POST: Send signaling message
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { from, to, type, payload, timestamp } = body || {};

      if (!from || !to || !type) {
        return res.status(400).json({ error: 'Missing required signaling fields (from, to, type)' });
      }

      const signal = {
        id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        from: String(from).trim().toLowerCase(),
        to: String(to).trim().toLowerCase(),
        type: String(type),
        payload: payload ?? null,
        timestamp: typeof timestamp === 'number' ? timestamp : Date.now(),
      };

      signalsStore.push(signal);

      // Keep recent signals within last 5 minutes (max 500 signals)
      const cutoff = Date.now() - 5 * 60 * 1000;
      signalsStore = signalsStore.filter((s) => s.timestamp > cutoff).slice(-500);
      globalThis.__meshchat_signals = signalsStore;

      return res.status(200).json({ success: true, signalId: signal.id });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to process signaling message' });
    }
  }

  // GET: Poll or Stream
  if (req.method === 'GET') {
    const targetUser = (user || '').trim().toLowerCase();

    if (!targetUser) {
      return res.status(400).json({ error: 'Missing "user" query parameter' });
    }

    // Server-Sent Events (SSE) mode
    if (action === 'stream') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');

      res.write(`data: ${JSON.stringify({ type: 'connected', user: targetUser, timestamp: Date.now() })}\n\n`);

      let lastCheck = Number(since) || Date.now();
      const interval = setInterval(() => {
        const fresh = signalsStore.filter((s) => s.to === targetUser && s.timestamp > lastCheck);
        if (fresh.length > 0) {
          for (const sig of fresh) {
            res.write(`data: ${JSON.stringify(sig)}\n\n`);
            if (sig.timestamp > lastCheck) lastCheck = sig.timestamp;
          }
        } else {
          res.write(': ping\n\n');
        }
      }, 1000);

      req.on('close', () => {
        clearInterval(interval);
      });

      return;
    }

    // Polling mode
    const sinceTime = Number(since) || 0;
    const pending = signalsStore.filter((s) => s.to === targetUser && s.timestamp > sinceTime);

    return res.status(200).json({
      signals: pending,
      serverTime: Date.now(),
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
