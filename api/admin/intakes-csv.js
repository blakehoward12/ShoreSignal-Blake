import { kv } from '@vercel/kv';
import { requireAdmin } from '../_auth.js';

function csvCell(v) {
  let s;
  if (v == null) s = '';
  else if (Array.isArray(v)) s = v.join('; ');
  else s = String(v);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  try {
    const ids = await kv.zrange('intakes:index', 0, -1, { rev: true });
    const records = ids.length
      ? (await kv.mget(...ids.map((i) => `intake:${i}`))).filter(Boolean)
      : [];

    const header = [
      'createdAt', 'name', 'email', 'brand_name', 'website',
      'product_and_customer', 'current_creators', 'current_method',
      'pain_point', 'goals', 'timeline', 'anything_else',
      'ip', 'userAgent',
    ];
    const rows = [header.join(',')];
    for (const r of records) {
      rows.push(header.map((k) => csvCell(r[k])).join(','));
    }
    const csv = rows.join('\n') + '\n';

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shore-signal-intakes-${stamp}.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error('admin intakes-csv error', err);
    return res.status(500).json({ error: 'Failed to export.' });
  }
}
