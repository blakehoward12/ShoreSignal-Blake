import { kv } from '@vercel/kv';
import { requireAdmin } from '../_auth.js';

function csvCell(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  try {
    const emails = await kv.zrange('leads:index', 0, -1, { rev: true });
    const records = emails.length
      ? (await kv.mget(...emails.map((e) => `lead:${e}`))).filter(Boolean)
      : [];

    const header = ['email', 'source', 'createdAt', 'ip', 'userAgent'];
    const rows = [header.join(',')];
    for (const r of records) {
      rows.push(header.map((k) => csvCell(r[k])).join(','));
    }
    const csv = rows.join('\n') + '\n';

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shore-signal-leads-${stamp}.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error('admin csv error', err);
    return res.status(500).json({ error: 'Failed to export.' });
  }
}
