// Shared admin auth helper. Compares a header against ADMIN_PASSWORD in constant time.
import crypto from 'node:crypto';

function safeEqual(a, b) {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function requireAdmin(req, res) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: 'ADMIN_PASSWORD is not configured.' });
    return false;
  }
  const header = req.headers['authorization'] || '';
  const provided = header.startsWith('Bearer ')
    ? header.slice(7).trim()
    : '';
  if (!provided || !safeEqual(provided, expected)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
