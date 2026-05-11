import { kv } from '@vercel/kv';
import { sendMetaEvent, newEventId } from './_meta.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const email = String(body.email || '').trim().toLowerCase();
  const source = String(body.source || 'unknown').slice(0, 32);
  const eventId = String(body.eventId || '').slice(0, 64) || newEventId();
  const pageUrl = String(body.pageUrl || '').slice(0, 512);

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email.' });
  }

  const now = Date.now();
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '';
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 256);
  const cookies = parseCookies(req.headers.cookie);
  const fbp = cookies._fbp || '';
  const fbc = cookies._fbc || '';

  const record = {
    email,
    source,
    createdAt: new Date(now).toISOString(),
    ip,
    userAgent,
  };

  try {
    const key = `lead:${email}`;
    const existing = await kv.get(key);
    if (!existing) {
      await kv.set(key, record);
      await kv.zadd('leads:index', { score: now, member: email });
    }
  } catch (err) {
    console.error('subscribe storage error', err);
    return res.status(500).json({ error: 'Could not save right now. Try again shortly.' });
  }

  // Fire Meta Conversions API event (non-blocking on failure).
  // The browser pixel sends the same eventId so Meta dedupes them.
  try {
    await sendMetaEvent({
      eventName: 'Lead',
      eventId,
      email,
      source,
      ip,
      userAgent,
      fbp,
      fbc,
      eventSourceUrl: pageUrl,
    });
  } catch (err) {
    console.error('CAPI dispatch error', err);
  }

  return res.status(200).json({ ok: true, eventId });
}
