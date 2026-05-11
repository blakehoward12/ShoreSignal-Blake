import { kv } from '@vercel/kv';
import { requireAdmin } from '../_auth.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  try {
    // Newest first
    const emails = await kv.zrange('leads:index', 0, -1, { rev: true });
    if (!emails || emails.length === 0) {
      return res.status(200).json({ leads: [] });
    }
    const keys = emails.map((e) => `lead:${e}`);
    const records = await kv.mget(...keys);
    const leads = records.filter(Boolean);
    return res.status(200).json({ leads });
  } catch (err) {
    console.error('admin list error', err);
    return res.status(500).json({ error: 'Failed to load leads.' });
  }
}
