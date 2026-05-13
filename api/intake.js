import { kv } from '@vercel/kv';
import crypto from 'node:crypto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIELDS = [
  ['name', 200],
  ['email', 254],
  ['brand_name', 200],
  ['website', 512],
  ['product_and_customer', 2000],
  ['current_creators', 100],
  ['current_method', 100],
  ['pain_point', 2000],
  ['timeline', 500],
  ['anything_else', 2000],
];

function clean(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
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

  const record = {};
  for (const [k, max] of FIELDS) record[k] = clean(body[k], max);

  if (!record.email || !EMAIL_RE.test(record.email)) {
    return res.status(400).json({ error: 'Please enter a valid email.' });
  }
  if (!record.name) {
    return res.status(400).json({ error: 'Please enter your name.' });
  }
  if (!record.brand_name) {
    return res.status(400).json({ error: 'Please enter your brand name.' });
  }

  const goals = Array.isArray(body.goals)
    ? body.goals.map((g) => clean(g, 100)).filter(Boolean).slice(0, 20)
    : (body.goals ? [clean(body.goals, 100)] : []);
  record.goals = goals;

  const now = Date.now();
  const id = crypto.randomUUID();
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '';
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 256);

  record.email = record.email.toLowerCase();
  record.id = id;
  record.createdAt = new Date(now).toISOString();
  record.ip = ip;
  record.userAgent = userAgent;

  try {
    await kv.set(`intake:${id}`, record);
    await kv.zadd('intakes:index', { score: now, member: id });
  } catch (err) {
    console.error('intake storage error', err);
    return res.status(500).json({ error: 'Could not save right now. Try again shortly.' });
  }

  return res.status(200).json({ ok: true });
}
