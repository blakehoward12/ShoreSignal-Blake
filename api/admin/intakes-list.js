import { kv } from '@vercel/kv';
import { requireAdmin } from '../_auth.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  try {
    const ids = await kv.zrange('intakes:index', 0, -1, { rev: true });
    if (!ids || ids.length === 0) {
      return res.status(200).json({ intakes: [] });
    }
    const records = await kv.mget(...ids.map((i) => `intake:${i}`));
    const intakes = records.filter(Boolean);
    return res.status(200).json({ intakes });
  } catch (err) {
    console.error('admin intakes-list error', err);
    return res.status(500).json({ error: 'Failed to load intakes.' });
  }
}
